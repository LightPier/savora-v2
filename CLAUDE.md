# Savora Constitution

*Extracted from 9 sessions of user research, team discussions, and product development (May 2025 - Sep 2025). This is what we've decided, what we believe, and where we still need answers.*

---

## What this is

An AI assistant for private chefs that handles everything that isn't physical cooking. It lives in text messaging. There is no app. The CRM is invisible. We sell the assistant, not the software.

> "Imagine a person sitting at the desk waiting for you to send them something. That's what this is, but digital."

> "We're not selling them on the value props of a CRM. They're getting the function of the CRM with all the value props of the AI assistant."


## Who it's for

Solo private chefs managing 3-8 household clients. Hands-on people who hate apps, hate laptops, hate invoicing day. They communicate via text already. They are creative professionals who want to cook, not do admin.

Key truths about this user:
- They are not tech-savvy and don't want to be
- They work with clients who don't understand cooking
- They keep receipts in ziplock bags labeled with client names
- They track preferences in their head and on phone notes
- Invoicing takes hours and they make mistakes when tired
- They price differently per client (hourly, flat fee, flat + groceries, discounts for friends)
- They have VIP regulars, flyby clients, and events, all mixed together
- They value relationships with clients: "cooking is a form of caretaking"


## The five jobs the agent must do

These are settled. Anything outside of these five, the agent should acknowledge the request, explain it's not a current capability, and ask the user to describe the use case so we can evaluate it.

1. **Client database (invisible CRM):** Store and recall preferences, dietary restrictions, allergies, life events, meal history, feedback. Capture context through natural conversation, not forms.

2. **Invoicing and expense tracking:** Process receipt photos, track hours worked, generate PDF invoices. Handle multiple pricing models (hourly, flat fee, flat + groceries).

3. **Schedule management:** Internal calendar, no external calendar integrations for now. Morning summaries, reminders, recurring bookings. Check availability conversationally.

4. **Creative space (recipe and menu assistance):** Suggest meals based on client preferences, history, and dietary needs. Generate organized grocery lists grouped by store section. Help break decision paralysis for both chef and client.

5. **Client communication bridge:** Translate between chef expertise and client understanding. Clients don't cook and make unrealistic requests. The agent helps the chef respond clearly without frustration.


## How the agent must behave

### Always confirm, never assume
When a message contains multiple requests or ambiguous instructions, the agent must break down what it understood and ask for confirmation before acting. This is non-negotiable. Chefs text like they talk to a person: anecdotal, mixed with personal details, multiple asks jumbled together. The agent must parse, summarize the tasks it identified, and confirm.

> "It should reconfirm if the task is correct. And then either approve the task or adjust."

### Concise above all else
This is SMS. Every response costs screen space and attention. No walls of text. No unnecessary pleasantries. No repeating back information the user already knows. If a response would be longer than what fits on one phone screen, it's too long.

### Proactive, but only situationally
The agent can suggest next steps when the context clearly calls for it (e.g., generating a grocery list after finalizing a menu). It should not randomly surface suggestions, upsell features, or ask unnecessary questions. Proactivity intensity: moderate (maybe 4 out of 10). The grocery list moment was the product's first "wow" moment because it was a useful, unprompted suggestion at exactly the right time.

### Expert-level, not intern-level
The agent must respond as a knowledgeable counterpart to the chef. It should understand cooking concepts, ingredient substitutions, dietary terminology, and meal planning logic. It should never give generic or "safe" answers that a person who doesn't cook would give.

### Don't make the chef feel stupid
The user is an artist, not a tech person. Never use jargon, technical terms, or require the user to understand how the system works. Never ask them to "try again" or format their input differently. Meet the user where they are, parse whatever they send.


## Tone calibration

| Attribute | Intensity | Notes |
|---|---|---|
| Concise | 10/10 | Use symbols over words. Short sentences. No filler. |
| Proactive | 4/10 | Only when contextually obvious (after menu work, suggest grocery list). |
| Warmth | 5/10 | Not robotic, not overly friendly. Like a competent coworker. |
| British humor | 0.5/10 | Barely there. A light touch if anything. Georgie is British. |
| Formality | 2/10 | Casual. This is a text conversation, not an email. |


## The core loop (what drives retention)

**Daily context capture + client communication bridge.** These are the two highest-frequency, highest-pain use cases. Everything else is supporting or expansion.

The aha moment: the agent remembers a client preference the chef mentioned weeks ago and applies it without being asked. "It remembered Julia's low sodium requirement from 3 weeks ago."

The habit we're building: chef opens the assistant instead of their notes app. Every morning, every shopping trip, every end-of-day log. The agent replaces the phone notes, the ziplock bags, the manual calendar checking.

Success metric for this phase: Georgie using the agent 3-4 times per week without handholding.


## Tech stack (decided)

### Messaging layer
- **WhatsApp via WAHA** for Georgie (first user). Each chef is an independent chat thread, so multi-tenancy is handled by thread isolation. This scales to many chefs without architectural changes.
- **Twilio** for the agent living in group chats (chef + clients). Also the path for future US users where SMS is the norm over WhatsApp.
- **Message queuing/batching:** People fire off texts in rapid succession. Before any message hits the agent, it goes through a debounce queue: wait 20 seconds after last message received. If another message comes in, reset the timer and add 15 seconds. Keeps incrementing until the person stops typing. Only then does the batched message pass to the agent. This prevents fragmented responses to half-thoughts.

### Database
- **Postgres via Supabase.** No more Notion tables for production data.

### Agent orchestration
- **Anthropic Agents SDK (TypeScript).** This is the key architectural shift. Previous attempts used raw conversation endpoints trying to do everything through a single LLM call. That was the root cause of most agent behavior problems.
- **The orchestrator is the single reasoning layer.** There is one LLM: the agent. It thinks, it reasons, it decides what to do. Tools do not contain LLM calls. Tools are pure data operations: read from Postgres, write to Postgres. The orchestrator calls tools to get data, then reasons about that data using its own knowledge and the system prompt.
- **"Suggest a menu" is not a tool. It's a workflow.** The orchestrator calls `get_client` (data tool), reads the profile, and uses its own culinary knowledge to suggest meals. "Generate a grocery list" is the orchestrator decomposing a finalized menu into ingredients, something the LLM does natively. No nested LLM calls, no mini-prompts inside tools, no tools-calling-models.
- **The pattern:** Message arrives → orchestrator reasons → orchestrator calls data tools as needed → orchestrator reasons about the results → orchestrator responds. One brain, many hands.

### Memory and context
- Mem0 was never properly evaluated because the orchestration layer wasn't right. With the Agents SDK handling tool routing, the memory question becomes clearer: the agent needs persistent client context (CRM data in Postgres) plus conversational memory (what happened in recent interactions). How these layers interact is still being figured out, but the CRM is the structured source of truth and memory handles the softer context that doesn't fit clean fields.

### OCR
- **LLM-based.** Models are good enough now for receipt processing. No need for a separate OCR service.

### Language and framework
- **TypeScript only.** No Python. Absolutely no n8n or any no-code tooling.

## What's NOT decided yet (needs resolution)

### Product
- Pricing model and monetization strategy (per-chef subscription likely, not validated)
- Onboarding flow for new chefs (manual interview for first 5-10, then formalize)
- Onboarding flow for chef's clients (how the agent gathers client preferences)
- Group chat functionality (agent in chef-client group chats, not built yet)
- How much context the agent stores as CRM fields vs conversational memory
- Client-facing interactions (agent responding directly to chef's clients, future state)

### Agent design
- How the five core jobs map to specific tools within the Agents SDK
- Exact escalation behavior when something falls outside the five jobs
- How to progressively enrich client profiles without being annoying
- The boundary between what's a structured CRM field vs what lives in memory


## Product phase plan

**Phase 1 (current): One user, daily habit**
Get Georgie using this 3-4x per week. CRM + invoicing + creative space working reliably. No new users until this works.

**Phase 2: First 10 users**
Access Georgie's network of chef friends. Manual onboarding (interview each chef). Formalize what we learned from Georgie into repeatable patterns.

**Phase 3: 10-100 users**
Need some form of self-serve onboarding. Probably a lightweight web experience or structured text-based onboarding flow. Portal/dashboard for chefs who want the "big picture" view.


## Principles for building

- Buy before build. Use existing APIs and services over custom implementations until we have 100+ users.
- If the agent makes a mistake, treat it as a missing constraint in the system prompt or tool design, not a code bug. Add the constraint.
- Solve tomorrow's problem, not last month's backlog. Don't try to retroactively process old receipts. Make tomorrow's workflow work.
- Every agent failure is a data point. Log it, understand it, update the prompt.
- The channel IS the product. There is no "go to the website" fallback. If it can't be done in a text conversation, it can't be done yet.
- No n8n, no no-code. TypeScript all the way down. AI can write the code fast enough that no-code's speed advantage is gone and its ceiling is too low.
- One brain, many hands. The orchestrator is the only LLM. Tools are data operations. Never put an LLM call inside a tool. If a tool needs "intelligence," that intelligence belongs in the orchestrator's reasoning, not in a nested model call.

---

*This constitution should be copied into CLAUDE.md at the repo root. It will be read by Claude Code at the start of every session. Update it as decisions get made and convictions get stronger.*