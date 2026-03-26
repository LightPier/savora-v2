# 002: WAHA Messaging Integration

*Status: Draft*
*Last updated: 2026-03-25*

---

## Overview

Wire the agent from 001 to WhatsApp via WAHA (WhatsApp HTTP API). The agent logic — `createAgent`, `runTurn`, all four tools, conversation persistence — is complete and tested via CLI. This spec adds the messaging layer: receive inbound WhatsApp messages, batch rapid-fire texts through a debounce queue, route the batched message to the agent, and send the response back to WhatsApp.

**What this build delivers:** A chef texts the Savora WhatsApp number, the agent processes their message (using the same logic the CLI uses), and the response appears as a WhatsApp reply.

**What this build does NOT include:** Image/media handling, group chat support, multi-session WAHA management, or any new agent capabilities. The agent is unchanged — only the transport layer is new.

**Success criteria:** Georgie sends a WhatsApp message, gets a response from the agent that correctly uses CRM tools and conversation history, and the experience is indistinguishable from the CLI (minus the typing indicators).

---

## Architecture

```
┌──────────────┐   webhook POST    ┌──────────────────────────────────────┐
│              │ ────────────────> │  Savora Server (Coolify container)   │
│  WAHA        │                   │                                      │
│  (Coolify)   │   sendText POST   │  ┌─────────┐   ┌────────────────┐   │
│  waha.       │ <──────────────── │  │ Webhook  │──>│ Debounce Queue │   │
│  lightpier.  │                   │  │ Handler  │   │ (per-chat)     │   │
│  io          │                   │  └─────────┘   └───────┬────────┘   │
│              │                   │                        │ flush      │
│  session:    │                   │  ┌─────────┐   ┌──────▼──────┐     │
│  savora      │                   │  │ WAHA    │<──│ Agent       │     │
│              │                   │  │ Client  │   │ Router      │     │
└──────────────┘                   │  └─────────┘   └──────┬──────┘     │
                                   │                       │            │
                                   │                ┌──────▼──────┐     │
                                   │                │ createAgent │     │
                                   │                │ + runTurn   │     │
                                   │                │ (from 001)  │     │
                                   │                └──────┬──────┘     │
                                   │                       │            │
                                   │                ┌──────▼──────┐     │
                                   │                │ Postgres    │     │
                                   │                │ (Supabase)  │     │
                                   │                └─────────────┘     │
                                   └──────────────────────────────────────┘
```

**Message flow:**

1. Chef sends a WhatsApp message to the Savora number
2. WAHA receives it and POSTs the webhook to the Savora server
3. The webhook handler extracts the phone number and message text
4. Chef identity is resolved: phone number → `chefs.id` lookup
5. The message enters the debounce queue for that chat
6. The debounce timer fires (no new messages within the window)
7. All queued messages are joined into a single string
8. Conversation history is loaded from `conversation_messages`
9. `createAgent(chefId)` + `runTurn(agent, messages)` — same as CLI
10. User messages and agent response are saved to `conversation_messages`
11. The agent's response is sent back via WAHA's `sendText` API
12. Chef receives the reply in WhatsApp

---

## WAHA Webhook

The Savora server exposes a single webhook endpoint that WAHA is configured to POST to.

### Endpoint

```
POST /webhook/waha
```

### Inbound payload (WAHA `message` event)

```json
{
  "event": "message",
  "session": "savora",
  "payload": {
    "id": "true_447000000001@c.us_3EB0A108D2B6...",
    "timestamp": 1711324800,
    "from": "447000000001@c.us",
    "body": "Hi, what should I cook for Julia today?",
    "fromMe": false,
    "hasMedia": false
  }
}
```

Key fields:
- `event` — only process `"message"` events. Ignore everything else (`ack`, `session.status`, etc.)
- `payload.from` — chat ID in WAHA format: `<country><number>@c.us`
- `payload.body` — the message text
- `payload.fromMe` — if `true`, the message was sent by the WAHA session itself (our outbound reply). **Must be ignored** to prevent the agent from responding to its own messages
- `payload.hasMedia` — `true` for images, audio, documents. Phase 1: text-only processing. Media messages are passed through to the agent with a system annotation (see Validation below) so the orchestrator can respond in its own voice

### Validation

The handler must check:
1. `event === "message"` — drop non-message events silently
2. `payload.fromMe === false` — drop our own outbound messages (see also Echo Loop Prevention below)
3. `payload.body` is a non-empty string **OR** `payload.hasMedia === true` — drop messages with neither text nor media
4. `session === "savora"` — drop messages from other sessions (defensive, shouldn't happen)

**Media messages:** If `hasMedia` is true and `body` is empty, enqueue with the synthetic text `[user sent an image, text-only processing available]`. If `hasMedia` is true and `body` is non-empty (image with a caption), enqueue with `[user sent an image, text-only processing available]\n{body}`. The webhook layer handles transport — the agent handles language. The orchestrator decides how to respond to media in its own voice, not hardcoded copy in the webhook handler

### Echo Loop Prevention

The `fromMe` check is the primary defense against the agent responding to its own messages. But it's not sufficient on its own — if there's a delay between sending via WAHA and the webhook arriving, or if `fromMe` is unreliable for edge cases, the agent could enter a response loop.

**Secondary check:** The WAHA client maintains a short-lived set of outbound message texts (keyed by `chatId + text`, expires after 60 seconds). When an inbound message arrives, the webhook handler checks this set. If the inbound message text exactly matches a recent outbound message to the same chat, it's dropped as an echo.

```typescript
// In waha-client.ts
const recentOutbound = new Map<string, number>(); // key → expiry timestamp

function recordOutbound(chatId: string, text: string): void {
  const key = `${chatId}:${text}`;
  recentOutbound.set(key, Date.now() + 60_000);
}

function isEcho(chatId: string, text: string): boolean {
  const key = `${chatId}:${text}`;
  const expiry = recentOutbound.get(key);
  if (expiry && Date.now() < expiry) {
    recentOutbound.delete(key);
    return true;
  }
  return false;
}

// Periodic cleanup of expired entries (every 60s)
```

`sendText` calls `recordOutbound` after each successful send. The webhook handler calls `isEcho` before enqueuing. Belt and suspenders — `fromMe` handles 99% of cases, this catches the rest.

### Response

Return `200 OK` immediately with `{ status: "queued" }`. All processing happens asynchronously after the webhook responds. WAHA will retry on non-2xx responses, so fast acknowledgment prevents duplicate processing.

---

## Phone Number Normalization

WAHA and the database use different phone number formats. All conversions go through a normalization layer.

| Context | Format | Example |
|---|---|---|
| WAHA chat ID | `<number>@c.us` | `447000000001@c.us` |
| `chefs.phone` (Postgres) | `+<number>` | `+447000000001` |

**Conversion functions:**

```typescript
function chatIdToPhone(chatId: string): string {
  // "447000000001@c.us" → "+447000000001"
  return "+" + chatId.split("@")[0];
}

function phoneToChatId(phone: string): string {
  // "+447000000001" → "447000000001@c.us"
  return phone.replace("+", "") + "@c.us";
}
```

These live in a shared utility and are the **only** place format conversion happens. Every other module works with one format or the other, never both.

---

## Chef Identity Resolution

Every inbound message must be resolved to a `chef_id` before it can be processed. The chef's phone number is the identity key — there is no login, no auth token, no session cookie.

### Lookup

```sql
SELECT id, name, phone FROM chefs WHERE phone = $1;
```

Where `$1` is the normalized phone number from `chatIdToPhone(payload.from)`.

### Cache

Chef records change rarely. An in-memory `Map<phone, { chefId, name }>` avoids hitting Postgres on every inbound message. The cache:
- Is populated on first lookup per phone number
- Has no TTL (server restart clears it, which is fine for Phase 1)
- Is bypassed if the phone number is not in the cache (cache miss → DB query → populate cache)

**Known risk (Phase 2):** If a chef's phone number is updated in the database without restarting the server, the old number stays in the cache (still resolving to the chef) and the new number is unknown (silent message drops). With one chef this is a manual restart. At 10+ chefs, add either a short TTL (5 minutes) or cache invalidation on write

### Unknown numbers

If the phone number doesn't match any chef, the server:
1. Logs a warning: `"Unknown sender: +44..."` (redact last 4 digits in production)
2. Does **not** respond to the sender — no "who are you?" reply. Silent drop
3. Returns without further processing

This is correct for Phase 1 (one known chef). Phase 2 will need an onboarding path for unknown numbers.

---

## Debounce Queue

People fire off texts in rapid succession. The debounce queue groups rapid-fire messages into a single batch before sending them to the agent. This prevents the agent from processing half-thoughts and generating fragmented responses.

### Algorithm

Per-chat (keyed by WAHA `chatId`):

1. **First message arrives:** Create a queue entry. Set timer to **20 seconds**
2. **Additional message arrives before timer fires:** Clear the timer. Add the message to the queue. Set a new timer for **20 + (N-1) × 15 seconds**, where N is the total number of messages in the queue
3. **Timer fires (no new messages in the window):** Flush the queue — join all messages and route to the agent

**Timer duration formula:**

```
timeout_ms = min(20_000 + (message_count - 1) * 15_000, 120_000)
```

The 120-second cap prevents unbounded waits if someone sends a very long stream of messages.

**Example timeline:**

```
T+0s     Chef sends: "hey"            → timer set to 20s (fires at T+20s)
T+3s     Chef sends: "for julia"      → timer reset to 35s (fires at T+38s)
T+5s     Chef sends: "shes coming     → timer reset to 50s (fires at T+55s)
          tuesday"
T+55s    Timer fires                   → flush: "hey\nfor julia\nshes coming tuesday"
```

### Queue entry structure

```typescript
interface QueueEntry {
  chatId: string;          // WAHA chat ID (key)
  chefId: string;          // resolved chef identity
  chefName: string;        // for logging
  messages: string[];      // accumulated message bodies
  timer: NodeJS.Timeout;   // active debounce timer
}
```

### Flush behavior

When the timer fires:

1. Remove the queue entry from the map (prevents new messages from appending to a flushing batch)
2. Join all messages with `\n` into a single string
3. Hand off to the agent router (async — the queue doesn't wait for the agent to finish)

### Concurrency guard

Only one agent invocation can run per chat at a time. If the agent is still processing a previous batch when a new flush triggers, the new batch must wait. Implementation: a per-chat processing lock (a `Set<chatId>` of in-flight chats, or a `Map<chatId, Promise>`).

If a batch flushes while the previous batch is still being processed:
1. Hold the new batch in a "pending" state
2. When the in-flight invocation completes, process the pending batch
3. Do **not** merge the pending batch into the in-flight one — that would mutate state mid-processing

### In-memory only

The debounce queue lives in memory. On server restart, any queued (unflushed) messages are lost. This is acceptable: WAHA retains message history, and the window is at most 2 minutes. If this becomes a problem, the queue can be moved to Redis, but that's not needed for Phase 1.

---

## Agent Routing

When the debounce queue flushes, the batched message is routed to the agent using the same `createAgent` and `runTurn` from 001. The flow is identical to the CLI — the server is just a different entry point.

### Flow

```typescript
async function handleBatch(chefId: string, chatId: string, batchedText: string): Promise<void> {
  // 1. Load conversation history (same as CLI startup)
  const messages = await loadRecentMessages(chefId);

  // 2. Append the batched user message
  messages.push({ role: "user", content: batchedText });

  // 3. Save the user message to conversation_messages
  await saveMessage(chefId, "user", batchedText);

  // 4. Create agent and run turn (same as CLI)
  const agent = createAgent(chefId);
  const result = await runTurn(agent, messages);

  // 5. Save the assistant response
  await saveMessage(chefId, "assistant", result.response);

  // 6. Send the response back via WAHA
  await sendText(chatId, result.response);
}
```

### Shared code with CLI

The server imports from the same modules the CLI uses:
- `createAgent` from `src/agent/index.ts`
- `runTurn` from `src/agent/index.ts`
- `loadRecentMessages`, `saveMessage` from `src/db/conversations.ts`

No duplication of agent logic. The CLI stays as a dev/testing tool.

### Error handling

If `runTurn` throws:
1. Log the full error with chef ID and chat ID
2. Send a fallback message to the chef: `"Something went wrong on my end. Try again in a moment."`
3. Do **not** save the failed exchange to conversation history — the chef's message was already saved, but the failed response should not pollute context
4. Release the per-chat concurrency lock so subsequent messages aren't blocked

---

## WAHA Client (Send Responses)

A thin HTTP client for the WAHA API. Phase 1 only needs `sendText`.

### Configuration

| Env var | Value | Notes |
|---|---|---|
| `WAHA_API_URL` | `https://waha.lightpier.io` | Base URL of the WAHA instance |
| `WAHA_API_KEY` | `(secret)` | API key for WAHA authentication |
| `WAHA_SESSION` | `savora` | Session name, defaults to `"savora"` |

### `sendText`

```
POST {WAHA_API_URL}/api/sendText
Headers:
  Content-Type: application/json
  X-Api-Key: {WAHA_API_KEY}

Body:
{
  "chatId": "447000000001@c.us",
  "text": "Got it — miso-glazed cod and kale salad. Want me to do the grocery list?",
  "session": "savora"
}
```

**Response:** 2xx on success. Non-2xx should be logged but not retried immediately — the chef will notice if they don't get a reply and text again.

### Message length

WhatsApp has a ~65,000 character limit per message. The agent's responses are SMS-concise by design (system prompt enforces this), so hitting the limit is unlikely. No splitting logic needed for Phase 1.

---

## Server Configuration

### HTTP server

The server is a lightweight Express app. It serves three purposes: accept WAHA webhooks, provide a health check for Coolify, and (later) expose any admin endpoints.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/webhook/waha` | WAHA message webhook |
| `GET` | `/health` | Coolify health check — returns `200 { status: "ok" }` |

### Environment variables

All existing env vars from 001 carry over. New additions:

| Var | Required | Description |
|---|---|---|
| `WAHA_API_URL` | Yes | WAHA instance URL (`https://waha.lightpier.io`) |
| `WAHA_API_KEY` | Yes | WAHA API key for authentication |
| `WAHA_SESSION` | No | Session name, defaults to `"savora"` |
| `PORT` | No | Server listen port, defaults to `3000` |
| `WEBHOOK_SECRET` | No | Shared secret to validate inbound webhooks (if WAHA supports it) |

### Dependencies

New packages (added to existing `package.json`):

```
express         — HTTP server
@types/express  — TypeScript types (devDependency)
```

All HTTP calls to the WAHA API use Node's built-in `fetch` (available since Node 18). No axios or other HTTP client library.

### npm scripts

```json
{
  "server": "tsx src/server/index.ts",
  "cli": "tsx src/cli/index.ts"
}
```

Both scripts remain available. The CLI is for local development and testing. The server is the production entry point.

---

## Deployment (Coolify)

### Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx tsc
CMD ["node", "dist/server/index.js"]
EXPOSE 3000
```

**Notes:**
- Uses `node:20-slim` for minimal image size
- `npm ci --omit=dev` excludes devDependencies (tsx, @types/node) from the production image
- The compiled output runs via `node`, not `tsx` — no dev tooling in production
- Port 3000 is the default; Coolify maps it to the external URL
- **tsconfig compatibility:** The existing tsconfig already has `outDir: "dist"` and `rootDir: "src"`, and `include` covers all of `src/`. The `tsc` build compiles everything under `src/` — agent, tools, db, cli, and server — into `dist/`. The CLI code compiles too (harmless, just unused in the container). No tsconfig changes needed

### Coolify configuration

- **Build pack:** Dockerfile
- **Port:** 3000
- **Health check:** `GET /health`
- **Environment variables:** Set in Coolify's UI (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, WAHA_API_URL, WAHA_API_KEY)

### WAHA webhook configuration

After deploying the Savora server, configure WAHA to send webhooks:

```
PUT {WAHA_API_URL}/api/session/savora
Headers:
  X-Api-Key: {WAHA_API_KEY}
  Content-Type: application/json

Body:
{
  "config": {
    "webhooks": [
      {
        "url": "https://<savora-server-url>/webhook/waha",
        "events": ["message"]
      }
    ]
  }
}
```

The exact configuration method depends on WAHA's version. This may also be set via WAHA's dashboard or environment variables. Verify against the running instance.

---

## File Structure

New files created by this spec (within the existing project):

```
src/
  server/
    index.ts              — Express app, starts server, registers routes
    webhook.ts            — POST /webhook/waha handler: validate, normalize, enqueue
    debounce.ts           — DebounceQueue class: per-chat batching with timers
    chef-resolver.ts      — Phone → chef_id lookup with in-memory cache
    waha-client.ts        — sendText() and phone number conversion utilities
Dockerfile                — Production container build
.env.example              — Updated with WAHA_* vars
```

Existing files modified:
- `package.json` — add `express`, `@types/express`, `"server"` script

Existing files unchanged:
- `src/agent/index.ts` — `createAgent` and `runTurn` used as-is
- `src/db/conversations.ts` — `loadRecentMessages` and `saveMessage` used as-is
- `src/cli/index.ts` — stays as dev tool
- `src/tools/*` — unchanged
- `prompts/system.md` — unchanged

---

## Edge Cases

### Webhook handling

| Scenario | Expected behavior |
|---|---|
| WAHA sends a non-message event (ack, status) | Return 200, no processing |
| WAHA sends a `fromMe: true` message | Return 200, no processing (our own outbound reply) |
| WAHA sends a media message (image, audio) | Enqueue with `[user sent an image, text-only processing available]` annotation. The agent responds in its own voice — the webhook layer never generates user-facing copy |
| WAHA sends an empty body | Return 200, no processing |
| WAHA sends duplicate messages (retry on timeout) | The debounce queue deduplicates by message ID if available, otherwise accepts duplicates (they'll just be extra context in the batch — the agent handles redundancy gracefully) |
| Webhook receives a malformed payload | Return 400, log the error, no processing |

### Debounce queue

| Scenario | Expected behavior |
|---|---|
| Chef sends a single message and waits | 20-second delay, then processes |
| Chef sends 5 messages in 10 seconds | Batched. Timer: 20 + 4×15 = 80 seconds from last message |
| Chef sends messages over several minutes | Each message resets the timer with increasing delay. Cap at 120 seconds |
| Chef sends a message while the agent is processing a previous batch | New message enters a fresh queue entry. When the previous batch completes, the new batch processes |
| Server restarts while messages are queued | Queued messages are lost. Chef will re-send if they don't get a response. WAHA's message history is unaffected |

### Chef resolution

| Scenario | Expected behavior |
|---|---|
| Known chef sends a message | Resolved from cache or DB. Processing continues |
| Unknown phone number sends a message | Log warning. Silent drop — no reply sent |
| Chef changes phone number | Stale cache entry. Update the `chefs` table manually; server restart clears cache. Phase 2 should add cache invalidation |

### Agent errors

| Scenario | Expected behavior |
|---|---|
| `runTurn` throws (API error, timeout, etc.) | Send fallback message: "Something went wrong on my end. Try again in a moment." Log full error. Don't save failed response to history |
| WAHA `sendText` fails (WAHA down) | Log error. Chef doesn't get a reply — they'll text again. No retry loop |
| Supabase is unreachable | Agent tools will fail. The agent may still respond conversationally but can't access CRM data. Log the error. No special handling — the agent's error will be a natural language response about the failure |

---

## Out of Scope

- **Image/media processing** — receipt OCR is a future spec. This spec handles text only
- **Group chat support** — Twilio-based group chats are Phase 2+
- **Typing indicators** — WAHA supports "composing" status. Nice-to-have but not in this spec
- **Read receipts** — not needed for agent functionality
- **Rate limiting** — one chef, no abuse risk. Add when onboarding external users
- **Message queue persistence** — in-memory is fine for Phase 1. Redis or Postgres-backed queue if reliability becomes an issue
- **Multi-session WAHA** — one session (`savora`), one chef. Multi-session is a Phase 2 concern
- **Admin dashboard or monitoring** — logging to stdout is sufficient for Phase 1; Coolify provides log access

---

## Task Breakdown

### Dependency Graph

```
T1  HTTP server scaffolding (Express, health check, npm scripts, Dockerfile)
 ├─> T2  Phone normalization + chef identity resolver
 ├─> T3  Debounce queue
 └─> T4  WAHA client (sendText)

T5  Webhook handler + agent routing
     depends on: T2, T3, T4
     Wires everything together: webhook → resolve → enqueue → flush → agent → send

T6  WAHA webhook configuration + end-to-end verification
     depends on: T5 deployed to Coolify
```

T2, T3, and T4 are independent and can be built in any order (all depend only on T1).

---

### T1: HTTP Server Scaffolding

Set up the Express server with health check, npm scripts, and the Dockerfile.

**Depends on:** nothing (builds on existing project)

**Creates:**
- `src/server/index.ts` — Express app. Registers routes, reads `PORT` from env, starts listening. Logs `"Savora server listening on :3000"` on start
- `Dockerfile` — production build (node:20-slim, npm ci, tsc, node dist/server/index.ts)
- Updates `package.json` — add `express` dependency, `@types/express` devDependency, `"server": "tsx src/server/index.ts"` script
- Verifies `tsconfig.json` — `outDir: "dist"` and `rootDir: "src"` are already set from 001. No changes needed, but confirm `tsc` compiles all `src/` subdirectories (agent, tools, db, server) into `dist/` cleanly
- Updates `.env.example` — add `WAHA_API_URL`, `WAHA_API_KEY`, `WAHA_SESSION`, `PORT`

**Endpoints:**
- `GET /health` → `200 { status: "ok" }`
- `POST /webhook/waha` → stub returning `200 { status: "queued" }` (wired in T5)

**Verify:**
```bash
npm run server
# In another terminal:
curl http://localhost:3000/health
# → {"status":"ok"}
```

---

### T2: Phone Normalization + Chef Identity Resolver

Convert between WAHA chat ID format and database phone format. Look up chef identity with caching.

**Depends on:** T1

**Creates:**
- `src/server/chef-resolver.ts`

**Exports:**
- `chatIdToPhone(chatId: string): string` — `"447000000001@c.us"` → `"+447000000001"`
- `phoneToChatId(phone: string): string` — `"+447000000001"` → `"447000000001@c.us"`
- `resolveChef(chatId: string): Promise<{ chefId: string, name: string } | null>` — normalize phone, check cache, query DB on miss, return null for unknown numbers

**Verify:**
```bash
# Test script or inline tests:
npx tsx src/server/chef-resolver.ts
# Should resolve Georgie's phone number to her chef_id
# Should return null for an unknown number
```

---

### T3: Debounce Queue

In-memory per-chat message batching with escalating timers.

**Depends on:** T1

**Creates:**
- `src/server/debounce.ts`

**Exports:**
- `DebounceQueue` class:
  - `constructor(onFlush: (chatId: string, chefId: string, messages: string[]) => void)`
  - `enqueue(chatId: string, chefId: string, messageBody: string): void`
  - `pending(): number` — number of chats with queued messages (for health/debugging)

**Behavior:**
1. `enqueue()` adds the message to the chat's queue entry
2. Clears any existing timer for that chat
3. Sets a new timer: `min(20_000 + (N-1) * 15_000, 120_000)` ms
4. When the timer fires: calls `onFlush(chatId, chefId, messages)` and removes the entry

**Verify:**
```bash
# Test script that enqueues messages with delays and verifies flush timing:
npx tsx src/server/debounce.ts
# Should demonstrate:
# - Single message flushes after 20s
# - Two rapid messages flush after 35s from last message
# - Flush callback receives all queued messages
```

---

### T4: WAHA Client

HTTP client for sending messages via WAHA's API.

**Depends on:** T1

**Creates:**
- `src/server/waha-client.ts`

**Exports:**
- `sendText(chatId: string, text: string): Promise<void>` — POST to `{WAHA_API_URL}/api/sendText` with the session name and API key. Calls `recordOutbound` on success. Logs errors but does not throw (fire-and-forget with logging)
- `isEcho(chatId: string, text: string): boolean` — check if an inbound message matches a recent outbound (echo loop prevention)
- `recordOutbound(chatId: string, text: string): void` — called internally by `sendText`; tracks outbound messages for 60 seconds

**Verify:**
```bash
# Test script that sends a test message to a known chat ID:
npx tsx src/server/waha-client.ts
# Should send "Test from Savora server" to Georgie's WhatsApp
```

---

### T5: Webhook Handler + Agent Routing

Wire everything together: webhook receives messages, resolves chef, enqueues into the debounce queue, flushes to the agent, sends the response.

**Depends on:** T2, T3, T4

**Creates:**
- `src/server/webhook.ts` — Express router with the `POST /webhook/waha` handler

**Updates:**
- `src/server/index.ts` — import and mount the webhook router. Initialize the `DebounceQueue` with the flush handler. Set up the per-chat concurrency guard

**Webhook handler behavior:**
1. Validate the payload (event type, fromMe, body/hasMedia, session)
2. Check `isEcho(chatId, body)` — drop if it matches a recent outbound message
3. If `hasMedia` and no body: substitute `[user sent an image, text-only processing available]`
4. Resolve chef identity via `resolveChef(payload.from)`
5. If unknown chef: log and return 200
6. Enqueue into `DebounceQueue`
7. Return `200 { status: "queued" }`

**Flush handler behavior (`handleBatch`):**
1. Acquire per-chat processing lock
2. Join messages with `\n`
3. Load conversation history via `loadRecentMessages(chefId)`
4. Append batched message as `{ role: "user", content: batchedText }`
5. Save user message via `saveMessage(chefId, "user", batchedText)`
6. `createAgent(chefId)` + `runTurn(agent, messages)`
7. Save assistant response via `saveMessage(chefId, "assistant", result.response)`
8. Send response via `sendText(chatId, result.response)`
9. Release per-chat processing lock
10. If error: send fallback message, log, release lock

**Verify:**
```bash
# Start the server locally:
npm run server

# Simulate a WAHA webhook:
curl -X POST http://localhost:3000/webhook/waha \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message",
    "session": "savora",
    "payload": {
      "id": "test_001",
      "timestamp": 1711324800,
      "from": "447000000001@c.us",
      "body": "hey, remind me about Julia",
      "fromMe": false,
      "hasMedia": false
    }
  }'
# → {"status":"queued"}
# After 20 seconds: agent processes the message, response sent via WAHA
# Check conversation_messages table for the saved exchange
```

---

### T6: WAHA Webhook Configuration + End-to-End Verification

Deploy to Coolify, configure WAHA to point to the server, and verify the full loop.

**Depends on:** T5 deployed

**Steps:**
1. Push to the deployment branch / trigger Coolify build
2. Verify `GET /health` returns 200 on the Coolify URL
3. Configure WAHA's webhook to point to `https://<savora-server-url>/webhook/waha`
4. Send a WhatsApp message to the Savora number from Georgie's phone
5. Verify the agent responds in WhatsApp
6. Test the debounce: send 3 messages rapidly, verify they're batched into a single agent response
7. Test conversation continuity: reference a previous message's context in a follow-up

**Verify:**
- Georgie sends "hey" → receives a response within ~25 seconds (20s debounce + processing)
- Georgie sends "new client — Tomas, loves Italian" → agent parses and confirms
- Georgie sends "yes" → agent saves and acknowledges
- Georgie sends "what should I cook for Tomas?" → agent calls get_client, suggests Italian dishes

---

## Task Summary

| Task | Scope | Depends on | Files |
|------|-------|-----------|-------|
| T1 | HTTP server, health check, Dockerfile | — | src/server/index.ts, Dockerfile, package.json, .env.example |
| T2 | Phone normalization + chef resolver | T1 | src/server/chef-resolver.ts |
| T3 | Debounce queue | T1 | src/server/debounce.ts |
| T4 | WAHA send client | T1 | src/server/waha-client.ts |
| T5 | Webhook handler + agent routing | T2, T3, T4 | src/server/webhook.ts, src/server/index.ts (update) |
| T6 | Deploy + configure WAHA + verify | T5 deployed | Coolify config, WAHA webhook config |
