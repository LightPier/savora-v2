# 001: Task Breakdown — Creative Space + CRM

*Companion to: [001-creative-space-and-crm.md](./001-creative-space-and-crm.md)*

---

## Dependency Graph

```
T1  Project scaffolding + shared types
 └─> T2  Database schema, Supabase client, seed data
       ├─> T3  add_client tool
       ├─> T4  get_client tool
       ├─> T5  update_client tool
       └─> T6  log_meal tool

T7  System prompt (standalone, no code deps)

T8  Agent wiring with Agents SDK
     depends on: T3, T4, T5, T6, T7
 └─> T9  CLI test harness
       └─> T10  Conversation history persistence
```

T3–T6 can be built in any order (all depend only on T2). T7 can be built at any point — it has no code dependencies.

---

## T1: Project Scaffolding + Shared Types

Initialize the TypeScript project and define the data types that every downstream task consumes.

**Depends on:** nothing

**Creates:**
- `package.json` — dependencies: `@anthropic-ai/sdk`, `@supabase/supabase-js`, `dotenv`; devDependencies: `typescript`, `tsx`, `@types/node`
- `tsconfig.json` — strict mode, ES2022 target, NodeNext module resolution
- `.gitignore` — node_modules, .env, dist
- `.env.example` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- `src/types.ts` — TypeScript interfaces mirroring every Postgres table: `Chef`, `Client`, `DietaryPreference`, `Allergy`, `MealHistory`, `MealDish`, `ClientNote`. Plus input/output types for each tool: `AddClientInput`, `AddClientOutput`, `GetClientInput`, `GetClientOutput`, `UpdateClientInput`, `UpdateClientOutput`, `LogMealInput`, `LogMealOutput`
- Directory structure: `src/`, `src/db/`, `src/tools/`, `src/agent/`, `src/cli/`, `prompts/`, `supabase/migrations/`

**Verify:**
```bash
npm install
npx tsx src/types.ts   # compiles without error
```

**Output for downstream tasks:** All tool tasks import types from `src/types.ts`. All tasks use the dependency and build setup.

---

## T2: Database Schema, Supabase Client, Seed Data

Create the Postgres schema, establish the database connection, and seed the first chef (Georgie).

**Depends on:** T1

**Creates:**
- `supabase/migrations/001_initial_schema.sql` — all 7 tables from the spec (`chefs`, `clients`, `dietary_preferences`, `allergies`, `meal_history`, `meal_dishes`, `client_notes`), all indexes, and `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- `src/db/client.ts` — Supabase client singleton using service role key from env. Exports `supabase` instance
- `src/db/seed.ts` — inserts Georgie as the chef (name, phone, location, default_hourly_rate). Idempotent: skips if a chef with that phone already exists. Prints the chef_id on success

**Verify:**
```bash
# Apply migration to your Supabase project (via Supabase dashboard SQL editor or supabase CLI)
npx tsx src/db/seed.ts
# Should print: "Seeded chef: Georgie (<uuid>)"
# Running again should print: "Chef already exists: Georgie (<uuid>)"
```

**Output for downstream tasks:** All tool tasks import `supabase` from `src/db/client.ts`. Georgie's chef_id is used as the hardcoded identity in the CLI harness.

---

## T3: `add_client` Tool

Persist a structured client record across multiple tables in a single transaction.

**Depends on:** T2

**Creates:**
- `src/tools/add-client.ts`

**Exports:**
- `addClient(input: AddClientInput): Promise<AddClientOutput>` — inserts into `clients`, `dietary_preferences`, `allergies`, and `client_notes` in a single Supabase RPC or sequential inserts. Returns `{ client_id, stored: { dietary_preferences_count, allergies_count, notes_count } }`
- `addClientToolDef` — the Agents SDK tool definition object: name (`"add_client"`), description, JSON Schema for input. Co-located with the handler so schema and implementation can't drift

**Behavior:**
1. Insert one row into `clients` with all provided fields
2. Insert N rows into `dietary_preferences` (one per preference)
3. Insert N rows into `allergies` (one per allergen)
4. Insert N rows into `client_notes` (one per note)
5. Return the client_id and counts of what was stored

**Verify:**
```bash
# Write a small script or add a main() block that calls addClient with test data:
npx tsx src/tools/add-client.ts
# Then check Supabase: the client, preferences, allergies, and notes should exist
```

**Output for downstream tasks:** T8 imports `addClientToolDef` to register with the agent.

---

## T4: `get_client` Tool

Retrieve a client profile with all related data. This is the tool the orchestrator calls before reasoning about menus, grocery lists, or anything that depends on client context.

**Depends on:** T2

**Creates:**
- `src/tools/get-client.ts`

**Exports:**
- `getClient(input: GetClientInput): Promise<GetClientOutput>` — searches by name (ILIKE + `pg_trgm` similarity), aliases (array overlap), and scheduling_pattern. On match, joins dietary_preferences, allergies, client_notes (last 10), and meal_history + meal_dishes (last 5 meals). On ambiguous match, returns multiple candidates
- `getClientToolDef` — Agents SDK tool definition

**Search strategy (in order):**
1. Exact name match (case-insensitive)
2. Alias array contains the query (case-insensitive)
3. `pg_trgm` similarity on name (threshold 0.3)
4. ILIKE on scheduling_pattern (for "Tuesday client" queries)
5. If 0 results: return `{ match: "none" }`
6. If 1 result: return full profile
7. If 2+ results: return `{ match: "ambiguous", candidates: [...] }` with names and IDs only

**Verify:**
```bash
# Requires a client from T3. Write a test script:
npx tsx src/tools/get-client.ts
# Search by exact name, partial name, misspelling, alias, scheduling pattern
```

**Output for downstream tasks:** T8 imports `getClientToolDef`. The orchestrator calls this before every menu suggestion, grocery list, or client lookup.

---

## T5: `update_client` Tool

Update specific fields on an existing client profile: add/remove preferences, allergies, notes, or update scalar fields on the clients table.

**Depends on:** T2

**Creates:**
- `src/tools/update-client.ts`

**Exports:**
- `updateClient(input: UpdateClientInput): Promise<UpdateClientOutput>` — validates client exists and belongs to chef_id, applies updates, returns summary of changes
- `updateClientToolDef` — Agents SDK tool definition

**Behavior:**
1. Verify client_id belongs to the chef (query clients table with both IDs)
2. If `dietary_preferences_add`: insert new rows into `dietary_preferences`
3. If `dietary_preferences_remove`: delete rows matching the preference text
4. If `allergies_add`: insert new rows into `allergies`
5. If `allergies_remove`: delete rows matching the allergen text
6. If `notes_add`: insert new rows into `client_notes`
7. If `field_updates`: update the `clients` row directly (name, address, pricing, etc.)
8. Update `clients.updated_at` timestamp
9. Return summary: `{ updated_fields, added, removed }`

**Verify:**
```bash
# Requires a client from T3. Write a test script that adds a preference then removes it:
npx tsx src/tools/update-client.ts
# Check Supabase to confirm changes
```

**Output for downstream tasks:** T8 imports `updateClientToolDef`.

---

## T6: `log_meal` Tool

Record a completed meal with per-dish feedback.

**Depends on:** T2

**Creates:**
- `src/tools/log-meal.ts`

**Exports:**
- `logMeal(input: LogMealInput): Promise<LogMealOutput>` — inserts one `meal_history` row and N `meal_dishes` rows. Returns `{ meal_id, dish_count }`
- `logMealToolDef` — Agents SDK tool definition

**Behavior:**
1. Insert into `meal_history` (client_id, chef_id, cooked_date, notes)
2. Insert into `meal_dishes` (one row per dish with name, feedback, notes)
3. Return `{ meal_id, dish_count }`

**Verify:**
```bash
# Requires a client from T3. Write a test script:
npx tsx src/tools/log-meal.ts
# Check meal_history and meal_dishes tables in Supabase
```

**Output for downstream tasks:** T8 imports `logMealToolDef`. Logged meals appear in `get_client` output and influence the orchestrator's menu suggestions.

---

## T7: System Prompt

Write the system prompt that encodes agent identity, behavioral rules, culinary expertise, and constraint-handling logic. This is the single surface area for tuning agent quality.

**Depends on:** nothing (standalone prose file)

**Creates:**
- `prompts/system.md`

**Content must cover:**
1. **Identity:** You are Savora, a text-based assistant for private chefs. One brain, many hands.
2. **Tone:** Concise (10/10), expert-level, warm but not effusive (5/10), casual (2/10 formality), barely-there British humor (0.5/10). This is SMS — one phone screen max per response.
3. **Core behavioral rules:**
   - Always confirm before writing to the database. Parse what you understood, present it, wait for approval.
   - Never assume. If ambiguous, ask.
   - Meet the chef where they are. Parse whatever they send — freeform, typos, nicknames, pronouns.
4. **Tool usage instructions:** When to call each tool, what data to extract before calling, the confirm-then-persist pattern.
5. **Menu suggestion workflow:** After calling `get_client`, how to reason about suggestions — respect allergies (hard constraint), honor preferences (soft constraint), avoid recent meals, factor in seasonality, keep suggestions concise (1-2 lines per dish, not full recipes).
6. **Grocery list workflow:** After menu finalization, proactively offer. Group by store section. Aggregate overlapping ingredients. Exclude items the chef has.
7. **Allergy safety:** Allergies are never optional. If the chef suggests something that conflicts with a stored allergy, catch it and redirect.
8. **Out-of-scope handling:** If the chef asks about receipts, invoicing, scheduling, or anything outside the five jobs — acknowledge, say it's not available yet, ask them to describe the use case.
9. **Edge cases from the spec:** Contradictory info, nickname-only clients, missing preferences, pronoun resolution, etc.

**Verify:** Manual review. Read it and check it covers all behavioral requirements from CLAUDE.md and the spec. The real test comes in T9 when you talk to the agent.

**Output for downstream tasks:** T8 loads this file as the agent's system prompt.

---

## T8: Agent Wiring with Agents SDK

Create the agent: load the system prompt, register all four tools, and export a function that takes a message and conversation history and returns the agent's response.

**Depends on:** T3, T4, T5, T6, T7

**Creates:**
- `src/agent/index.ts`

**Exports:**
- `createAgent(chefId: string): Agent` — or equivalent Agents SDK construct. Loads `prompts/system.md`, registers the four tool definitions (imported from T3-T6), injects `chefId` into every tool call's context
- `runTurn(agent, messages: Message[]): Promise<{ response: string, messages: Message[] }>` — sends the message history to the agent, handles any tool calls the agent makes, returns the final text response and the updated message array

**Key implementation details:**
- The Agents SDK manages the tool-call loop internally: if the agent calls a tool, the SDK invokes the handler, feeds the result back, and the agent continues reasoning until it produces a text response
- `chefId` is bound at agent creation time (closure or config) so tools don't need the orchestrator to pass it per-call. The agent's system prompt also receives chef context
- Messages are the Anthropic message format: `{ role: "user" | "assistant", content: string }`

**Verify:**
```bash
# Write a test script in src/agent/index.ts main():
# 1. Create agent with Georgie's chef_id
# 2. Send: "remind me about Julia" (assuming T3 test data exists)
# 3. Print the response
npx tsx src/agent/index.ts
```

**Output for downstream tasks:** T9 uses `createAgent` and `runTurn` to power the CLI loop.

---

## T9: CLI Test Harness

A readline-based terminal interface where the developer types messages as the chef and sees agent responses. This is the primary testing tool until WAHA is wired up.

**Depends on:** T8

**Creates:**
- `src/cli/index.ts`
- `package.json` update: add `"cli": "tsx src/cli/index.ts"` to scripts

**Behavior:**
1. On start: load Georgie's chef_id (from env or hardcoded from seed), create the agent
2. Print a brief welcome: "Savora CLI — type as Georgie. Ctrl+C to exit."
3. Enter readline loop:
   - Prompt: `chef> `
   - Read input
   - Append to in-memory message history as `{ role: "user", content: input }`
   - Call `runTurn(agent, messages)`
   - Print the agent's response (visually distinct — different color or prefix)
   - Append response to message history
   - Loop
4. Conversation history lives in memory for the session. Quitting loses it (T10 adds persistence)

**Verify:**
```bash
npm run cli
chef> hi, I'm Georgie
# Agent responds with a greeting, probably asks what it can help with
chef> New client — Julia Henderson. Pescatarian, allergic to shellfish. I cook for her every Tuesday.
# Agent parses, presents structured summary, asks for confirmation
chef> yes
# Agent confirms saved
chef> What should I cook for Julia?
# Agent calls get_client, reasons about menu, suggests dishes
chef> Let's go with the cod. Grocery list?
# Agent generates organized grocery list
```

**Output for downstream tasks:** T10 adds persistence to this CLI so context survives restarts.

---

## T10: Conversation History Persistence

Store conversation messages in Postgres so context survives across CLI restarts (and later, across WAHA message batches). This resolves the "conversational state across message batches" question from the spec using Option A: store the last N message pairs, load them at invocation start.

**Depends on:** T2, T9

**Creates:**
- `supabase/migrations/002_conversation_messages.sql` — new table: `conversation_messages(id, chef_id, role, content, created_at)`
- `src/db/conversations.ts` — `saveMessage(chefId, role, content)`, `loadRecentMessages(chefId, limit = 50): Message[]`
- Updates `src/cli/index.ts` — on start, load recent messages and inject into conversation history. After each exchange, save both user and assistant messages

**Schema:**
```sql
CREATE TABLE conversation_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id    UUID NOT NULL REFERENCES chefs(id),
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_messages_chef
  ON conversation_messages(chef_id, created_at DESC);
```

**Behavior:**
1. On CLI start: `loadRecentMessages(chefId, 50)` → inject into the agent's message array before the first user input
2. After each user message: `saveMessage(chefId, "user", input)`
3. After each agent response: `saveMessage(chefId, "assistant", response)`
4. The agent sees the last 50 messages as context, giving it full conversational continuity

**Why 50?** Enough to cover a multi-day working session (a chef might send 20-30 messages in a day). Token-budget impact is manageable because chef messages are short (SMS-length) and agent responses are concise by design. Tune this number based on observed token usage.

**Verify:**
```bash
npm run cli
chef> New client — Tomas. Loves Italian food.
# Agent confirms, saves
# Ctrl+C to quit
npm run cli
chef> What are Tomas's preferences?
# Agent should know about Tomas from loaded conversation history + CRM data
```

**Output:** This is the final task. After T10, the system is ready for end-to-end use via CLI and architecturally prepared for WAHA integration (the messaging layer just needs to call `loadRecentMessages` and `saveMessage` the same way the CLI does).

---

## Task Summary

| Task | Scope | Depends on | Files |
|------|-------|-----------|-------|
| T1 | Project scaffolding + types | — | package.json, tsconfig.json, .gitignore, .env.example, src/types.ts |
| T2 | Database schema + connection + seed | T1 | supabase/migrations/001_initial_schema.sql, src/db/client.ts, src/db/seed.ts |
| T3 | add_client tool | T2 | src/tools/add-client.ts |
| T4 | get_client tool | T2 | src/tools/get-client.ts |
| T5 | update_client tool | T2 | src/tools/update-client.ts |
| T6 | log_meal tool | T2 | src/tools/log-meal.ts |
| T7 | System prompt | — | prompts/system.md |
| T8 | Agent wiring (Agents SDK) | T3–T7 | src/agent/index.ts |
| T9 | CLI test harness | T8 | src/cli/index.ts |
| T10 | Conversation persistence | T2, T9 | supabase/migrations/002_conversation_messages.sql, src/db/conversations.ts |
