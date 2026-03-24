# 001: Creative Space + CRM (First Build)

*Status: Draft*
*Last updated: 2026-03-24*

---

## Overview

The first build combines the two core loop features: the invisible CRM and the creative space. They're co-dependent — you can't suggest meals without client data, and client data has no immediate payoff without creative assistance.

**What this build delivers:** A chef adds a client via freeform text, the agent parses it into structured Postgres fields, and the chef can then ask for menu ideas and a grocery list for that client based on stored preferences.

**What this build does NOT include:** Receipt processing, invoicing, scheduling, client communication bridge, or any external integrations.

**Success criteria:** Georgie adds her first client, gets a menu suggestion that respects stored preferences, and receives an organized grocery list — all within a single conversation flow.

---

## User Stories

### US-1: Add a client from freeform text

> As a chef, I want to text a dump of everything I know about a client and have the agent organize it, so I don't have to fill in forms.

**Trigger:** Chef sends a message like *"New client — Julia Henderson. She's pescatarian, allergic to shellfish (severe). Lives in Bozeman. I cook for her every Tuesday. $65/hr. She has two kids, hates cilantro, her birthday is in October."*

**Agent behavior:**
1. Parse the freeform text into structured fields
2. Present the parsed result back to the chef for confirmation
3. On confirmation, persist to Postgres
4. Acknowledge and prompt for anything obviously missing (e.g., no dietary info mentioned)

**Acceptance criteria:**
- [ ] Agent correctly extracts: name, dietary preferences, allergies (with severity), location, scheduling pattern, pricing, personal notes, and contact info when present
- [ ] Agent presents a concise summary of what it parsed and asks for confirmation before saving
- [ ] Chef can correct any field in the summary conversationally ("no, she's $75/hr not $65")
- [ ] Agent applies corrections and re-confirms only the changed fields
- [ ] Client record is persisted to Postgres only after chef confirms
- [ ] Agent handles partial information gracefully — does not require all fields, saves what's provided
- [ ] Response fits on one phone screen (SMS constraint)

### US-2: Update a client from conversational context

> As a chef, I want the agent to pick up on client details I mention in passing and update their profile, so I don't have to explicitly say "update Julia's profile."

**Trigger:** Mid-conversation, chef says something like *"oh btw Julia just found out she's pregnant"* or *"Simone told me she's going dairy-free"*

**Agent behavior:**
1. Detect that the message contains client-relevant context
2. Identify which client it refers to (by name, pronoun, or recent context)
3. Confirm the update: "Got it — adding pregnancy to Julia's profile. Anything else?"
4. Persist the update

**Acceptance criteria:**
- [ ] Agent detects client context updates embedded in casual messages
- [ ] Agent resolves ambiguous references ("her", "the Tuesday client") from recent conversation context
- [ ] Agent always confirms before writing updates — never silently modifies a profile
- [ ] Dietary changes update the `dietary_preferences` table
- [ ] Allergy changes update the `allergies` table
- [ ] Life events and personal context go to `client_notes`
- [ ] If the update contradicts existing data, agent flags the conflict and asks which is correct

### US-3: Look up a client

> As a chef, I want to ask the agent to remind me about a client and get back the relevant details, without having to remember exactly what I stored.

**Trigger:** Chef says *"remind me about Julia"* or *"what are Simone's restrictions?"* or *"who's my Tuesday client?"*

**Agent behavior:**
1. Resolve the client reference
2. Return relevant context, prioritizing what's most likely useful (dietary info, recent notes, upcoming schedule)
3. Keep it concise — not a full data dump unless asked

**Acceptance criteria:**
- [ ] Agent resolves clients by name, alias, nickname, scheduling pattern, or pronoun from recent context
- [ ] Default response shows: dietary preferences, allergies, recent notes, and scheduling pattern
- [ ] Chef can ask follow-up questions ("what about her pricing?") to get additional fields
- [ ] Response is concise — fits one phone screen for a typical client
- [ ] If multiple clients match a vague reference, agent asks for clarification

### US-4: Get menu suggestions for a client

> As a chef, I want to ask for menu ideas for a specific client and get suggestions that respect their preferences, restrictions, and history.

**Trigger:** Chef says *"I need to plan meals for Julia this Tuesday"* or *"what should I cook for Simone?"*

**Agent behavior:**
1. Resolve the client
2. Pull dietary preferences, allergies, and meal history
3. Suggest 3-5 menu ideas that respect all constraints
4. Support back-and-forth workshopping ("what about lamb?" / "she's pescatarian" / "right, fish then")

**Acceptance criteria:**
- [ ] Suggestions respect all stored dietary preferences and allergies
- [ ] Suggestions avoid meals cooked in the last 2 weeks (when meal history exists)
- [ ] Agent demonstrates expert-level culinary knowledge — no generic suggestions
- [ ] Each suggestion is 1-2 lines, not a full recipe. Enough to spark the chef's creativity
- [ ] Agent handles workshopping: chef can reject, modify, or redirect suggestions conversationally
- [ ] If client has no stored preferences, agent asks what it should know before suggesting
- [ ] Agent factors in seasonality when relevant (don't suggest heavy stews in July)
- [ ] If the chef mentions pantry items they already have, agent incorporates them

### US-5: Generate a grocery list from a finalized menu

> As a chef, I want a grocery list organized by store section after I finalize a menu, so I can shop efficiently.

**Trigger:** Chef finalizes a menu (explicitly or via conversational flow), OR agent proactively offers after menu workshopping settles.

**Agent behavior:**
1. Detect that the menu is finalized (chef confirms or stops iterating)
2. Proactively offer: "Want me to generate the grocery list?"
3. Generate a list grouped by store section
4. Exclude items the chef said they already have

**Acceptance criteria:**
- [ ] Grocery list is organized by section: produce, proteins, dairy, pantry, spices, other
- [ ] Items include reasonable quantities for the number of servings discussed
- [ ] If the chef mentioned items they already have, those are excluded
- [ ] Agent proactively offers the grocery list after menu finalization — this is the "wow" moment
- [ ] List is concise and scannable (designed for reading on a phone while shopping)
- [ ] If cooking for multiple clients in the same trip, agent can combine lists and note which items are for which client

### US-6: Log a completed meal

> As a chef, I want to tell the agent what I cooked and any feedback, so it can avoid repetition and improve future suggestions.

**Trigger:** Chef says *"Just finished cooking for Julia — did the miso-glazed cod and a kale salad. She loved the cod but didn't touch the salad."*

**Agent behavior:**
1. Parse the meal and feedback
2. Confirm: "Logged for Julia on Mar 24: miso-glazed cod (loved), kale salad (didn't eat). Got it."
3. Persist to meal history

**Acceptance criteria:**
- [ ] Agent extracts: client, date (defaults to today), dishes, and any feedback
- [ ] Feedback is captured per dish when provided, not just per meal
- [ ] Agent confirms the log before persisting
- [ ] Logged meals influence future menu suggestions (avoid recent repeats, favor hits, skip misses)
- [ ] Chef can log meals after the fact ("I cooked for Simone yesterday")

---

## Supabase Schema

### `chefs`

The chef user. One row per chef. Phase 1 has one chef (Georgie).

```sql
CREATE TABLE chefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT UNIQUE NOT NULL,   -- WhatsApp/SMS identifier
  location    TEXT,
  default_hourly_rate NUMERIC(10,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `clients`

One row per client household. Stores structured fields that the agent parsed from freeform text.

```sql
CREATE TABLE clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id           UUID NOT NULL REFERENCES chefs(id),
  name              TEXT NOT NULL,           -- primary name the chef uses
  aliases           TEXT[] DEFAULT '{}',     -- other names/references ("the Thursday family", "Jules")
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  household_size    INTEGER,
  client_type       TEXT DEFAULT 'regular'
                    CHECK (client_type IN ('vip', 'regular', 'flyby', 'event')),
  scheduling_pattern TEXT,                   -- freeform: "every Tuesday", "seasonal summer"
  pricing_model     TEXT
                    CHECK (pricing_model IN ('hourly', 'flat_fee', 'flat_plus_groceries', 'daily', 'custom')),
  pricing_rate      NUMERIC(10,2),
  pricing_notes     TEXT,                    -- "discount because she's a friend", custom terms
  general_notes     TEXT,                    -- kitchen layout, preferred stores, pet names, etc.
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_chef_id ON clients(chef_id);
```

### `dietary_preferences`

Normalized dietary preferences per client. Separate from allergies because the handling is different — preferences guide menu planning, allergies are safety constraints.

```sql
CREATE TABLE dietary_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  preference  TEXT NOT NULL,       -- "pescatarian", "low sodium", "gluten-free", "hates cilantro"
  notes       TEXT,                -- additional context
  source      TEXT,                -- how we learned this: "chef mentioned 2026-03-24"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dietary_client_id ON dietary_preferences(client_id);
```

### `allergies`

Allergies with severity. These are hard constraints — the agent must never suggest a dish containing an allergen.

```sql
CREATE TABLE allergies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  allergen    TEXT NOT NULL,        -- "shellfish", "peanuts", "tree nuts"
  severity    TEXT NOT NULL DEFAULT 'unknown'
              CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  notes       TEXT,                 -- "can tolerate small amounts of cooked dairy"
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_allergies_client_id ON allergies(client_id);
```

### `meal_history`

One row per cooking session. Linked to individual dishes via `meal_dishes`.

```sql
CREATE TABLE meal_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  chef_id         UUID NOT NULL REFERENCES chefs(id),
  cooked_date     DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_history_client_id ON meal_history(client_id);
CREATE INDEX idx_meal_history_cooked_date ON meal_history(cooked_date DESC);
```

### `meal_dishes`

One row per dish per meal. Normalized out of `meal_history` so `suggest_menu` can query dish names and feedback directly — "what dishes has Julia loved in the last month" is a simple `WHERE` clause instead of JSONB path gymnastics.

```sql
CREATE TABLE meal_dishes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id         UUID NOT NULL REFERENCES meal_history(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,       -- "miso-glazed cod"
  feedback        TEXT
                  CHECK (feedback IN ('loved', 'liked', 'neutral', 'disliked')),
  notes           TEXT,                -- "asked for the recipe", "didn't touch it"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_dishes_meal_id ON meal_dishes(meal_id);
CREATE INDEX idx_meal_dishes_feedback ON meal_dishes(feedback) WHERE feedback IS NOT NULL;
```

### `client_notes`

Freeform context that doesn't fit structured fields. Life events, personal details, kitchen info, preference changes over time.

```sql
CREATE TABLE client_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN ('life_event', 'personal', 'kitchen', 'preference_change', 'general')),
  content     TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_notes_client_id ON client_notes(client_id);
```

### Data Isolation and Auth Model

There is no Supabase Auth session. The chef texts via WhatsApp/WAHA — there's no login, no browser, no JWT from a client. Chef identity is resolved at the messaging layer: an inbound WhatsApp message arrives with a phone number, the server looks up the `chefs` row by `phone`, and passes `chef_id` into every subsequent query.

This means **standard Supabase RLS with `auth.uid()` does not apply here.** Two viable approaches:

**Option A: Service role + application-level filtering (recommended for Phase 1).** The agent server connects to Supabase with the service role key (bypasses RLS). Every query includes an explicit `WHERE chef_id = $1` clause. Simpler, and with one chef there's no multi-tenancy risk yet. The discipline is: every tool function takes `chef_id` as a required parameter and every query scopes to it. No query touches the database without a chef_id filter.

**Option B: Custom JWT claims (when multi-tenancy matters).** At message intake, the server mints a short-lived Supabase JWT with `chef_id` embedded as a custom claim. Queries use that JWT, and RLS policies reference `auth.jwt()->>'chef_id'` instead of `auth.uid()`. This is the right move at Phase 2 (10 chefs), not Phase 1.

For Phase 1, go with Option A. The RLS policies below are written for Option B and should be activated when the project moves to multi-tenant:

```sql
-- Phase 2: activate when switching from service role to per-chef JWTs
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY chef_clients ON clients
  FOR ALL USING (chef_id = (auth.jwt()->>'chef_id')::UUID);

CREATE POLICY chef_dietary ON dietary_preferences
  FOR ALL USING (client_id IN (
    SELECT id FROM clients WHERE chef_id = (auth.jwt()->>'chef_id')::UUID
  ));

CREATE POLICY chef_allergies ON allergies
  FOR ALL USING (client_id IN (
    SELECT id FROM clients WHERE chef_id = (auth.jwt()->>'chef_id')::UUID
  ));

CREATE POLICY chef_meals ON meal_history
  FOR ALL USING (chef_id = (auth.jwt()->>'chef_id')::UUID);

CREATE POLICY chef_meal_dishes ON meal_dishes
  FOR ALL USING (meal_id IN (
    SELECT id FROM meal_history WHERE chef_id = (auth.jwt()->>'chef_id')::UUID
  ));

CREATE POLICY chef_notes ON client_notes
  FOR ALL USING (client_id IN (
    SELECT id FROM clients WHERE chef_id = (auth.jwt()->>'chef_id')::UUID
  ));
```

---

## Agent Tools (Agents SDK)

Tools are pure data operations: read from Postgres, write to Postgres. They contain no LLM calls, no reasoning, no language generation. The orchestrator is the single reasoning layer — it decides what to do, calls tools to get or store data, and uses its own knowledge to reason about that data (suggesting menus, generating grocery lists, parsing freeform text into structured fields).

The pattern: message arrives → orchestrator reasons → orchestrator calls data tools as needed → orchestrator reasons about the results → orchestrator responds.

### `add_client`

Persist a structured client record. The orchestrator has already parsed the chef's freeform text and confirmed the result with the chef before calling this tool.

**Input:**
```typescript
{
  chef_id: string
  client: {
    name: string
    aliases?: string[]
    email?: string
    phone?: string
    address?: string
    household_size?: number
    client_type?: "vip" | "regular" | "flyby" | "event"
    scheduling_pattern?: string
    pricing_model?: "hourly" | "flat_fee" | "flat_plus_groceries" | "daily" | "custom"
    pricing_rate?: number
    pricing_notes?: string
    general_notes?: string
  }
  dietary_preferences?: { preference: string, notes?: string }[]
  allergies?: { allergen: string, severity: string, notes?: string }[]
  notes?: { category: string, content: string }[]
}
```

**Behavior:**
1. Insert into `clients`, `dietary_preferences`, `allergies`, and `client_notes` in a single transaction
2. Return the created client ID and a summary of what was stored

**Output:**
```typescript
{
  client_id: string
  stored: {
    dietary_preferences_count: number
    allergies_count: number
    notes_count: number
  }
}
```

**The orchestrator's job before calling this tool:** Parse the chef's freeform text into the structured input above. Present it to the chef for confirmation. Apply corrections. Only then call `add_client` with the confirmed data.

### `update_client`

Update specific fields on an existing client profile.

**Input:**
```typescript
{
  client_id: string
  updates: {
    dietary_preferences_add?: { preference: string, notes?: string }[]
    dietary_preferences_remove?: string[]
    allergies_add?: { allergen: string, severity: string }[]
    allergies_remove?: string[]
    notes_add?: { category: string, content: string }[]
    field_updates?: Record<string, any>  // direct field updates on clients table
  }
}
```

**Behavior:**
1. Validates the client exists and belongs to the chef
2. Applies the updates to the relevant tables
3. Returns the updated fields for confirmation

### `get_client`

Retrieve a client profile with all related data. This is the tool the orchestrator calls before reasoning about menus, grocery lists, or anything that depends on client context.

**Input:**
```typescript
{
  chef_id: string
  query: string          // name, alias, or descriptive reference ("Tuesday client")
}
```

**Behavior:**
1. Search `clients` by name and aliases (fuzzy match)
2. If no match, search by scheduling pattern or other fields
3. If ambiguous, return candidates for the orchestrator to present to the chef
4. On match, join dietary_preferences, allergies, recent client_notes, and recent meal_dishes

**Output:**
```typescript
{
  client: Client
  dietary_preferences: DietaryPreference[]
  allergies: Allergy[]
  recent_notes: ClientNote[]          // last 10
  recent_meals: {                     // last 5 meals with their dishes
    meal: MealHistory
    dishes: MealDish[]
  }[]
}
```

### `log_meal`

Record a completed meal and feedback. The orchestrator has already parsed the chef's message and confirmed the details before calling this tool.

**Input:**
```typescript
{
  client_id: string
  chef_id: string
  cooked_date: string          // ISO date, default today
  dishes: {
    name: string
    feedback?: "loved" | "liked" | "neutral" | "disliked"
    notes?: string
  }[]
  notes?: string
}
```

**Behavior:**
1. Insert one row into `meal_history`, then one row per dish into `meal_dishes`
2. Return the created meal ID and dish count

---

## Orchestrator Workflows

These are not tools. They are reasoning patterns the orchestrator performs using its own culinary knowledge and the data returned by tools. They are documented here because they define expected behavior and acceptance criteria, but they live in the system prompt, not in tool code.

### Menu suggestion workflow

1. Orchestrator calls `get_client` to load the client's full profile
2. Orchestrator reasons about menu options using:
   - Dietary preferences and allergies as hard constraints
   - Recent meal history (last 2 weeks) as a soft avoid-list
   - Dishes the client loved as inspiration for direction
   - Seasonality based on current date
   - Any constraints the chef mentioned in conversation
3. Orchestrator presents 3-5 suggestions to the chef
4. Chef pushes back, redirects, or approves — orchestrator adjusts using the same data, no additional tool calls needed unless the chef switches clients

**Why this isn't a tool:** The orchestrator already has culinary knowledge. It doesn't need a separate LLM call to suggest "miso-glazed cod" for a pescatarian. What it needs is the client data — that's what the tool provides. The reasoning is the orchestrator's job.

### Grocery list workflow

1. Chef finalizes a menu (through conversation, not a formal action)
2. Orchestrator proactively offers: "Want me to do the grocery list?"
3. On confirmation, orchestrator decomposes the finalized dishes into ingredients, aggregates across dishes, groups by store section, and applies reasonable quantities
4. Orchestrator excludes items the chef mentioned having on hand

**Why this isn't a tool:** Decomposing "miso-glazed cod" into miso paste, cod fillets, sesame oil, etc. is culinary knowledge the LLM has natively. No database query needed. No separate model call needed.

---

## Edge Cases

### Client parsing

| Scenario | Expected behavior |
|---|---|
| Chef sends a wall of text mixing personal anecdotes with client data | Agent separates actionable fields from context, confirms what it extracted, stores anecdotes as `client_notes` |
| Chef provides contradictory info ("she's vegan but loves my salmon") | Agent flags the contradiction explicitly and asks which is correct before saving |
| Chef uses a nickname with no full name ("just put her down as Jules") | Accept it. `name` field stores whatever the chef uses. No full name required |
| Chef provides almost no structured info ("new client, Tomas, cooks for him sometimes") | Save what's there (name only). Don't nag for more. Prompt lightly: "Got Tomas added. When you learn more about his preferences just let me know" |
| Chef sends info about a client that already exists | Agent recognizes the existing client and asks: "Update Tomas's profile with this, or is this a different Tomas?" |

### Client lookup

| Scenario | Expected behavior |
|---|---|
| Chef says "her" or "she" with no prior context | Agent asks who they mean. No guessing |
| Chef says "the Thursday family" | Search `scheduling_pattern` for Thursday matches. If one match, use it. If multiple, ask |
| Chef misspells the name ("Juila") | Fuzzy match against `name` and `aliases`. Suggest the closest match with confirmation |
| Chef references a client that doesn't exist | "I don't have a client by that name. Want to add them?" |

### Menu suggestions

| Scenario | Expected behavior |
|---|---|
| Client has no stored preferences (just added, no dietary info) | Agent says what it doesn't know and asks: "I don't have dietary info for Tomas yet. Any restrictions or preferences I should know before suggesting?" |
| Chef asks for something the client can't eat ("what about a shrimp dish for Julia?" when Julia has severe shellfish allergy) | Agent catches it: "Julia has a severe shellfish allergy — shrimp is off the table. How about [alternative]?" |
| No meal history exists (new client) | Suggest freely without repeat-avoidance. Note to chef: "No meal history for Julia yet, so these are based on her preferences only" |
| Chef mentions pantry items mid-conversation | Agent incorporates them in suggestions and excludes from grocery list |
| Chef asks for menus for multiple clients on the same day | Handle sequentially per client, or if the chef asks for a combined plan, merge with clear per-client labels |

### Grocery list

| Scenario | Expected behavior |
|---|---|
| Menu has overlapping ingredients across dishes | Aggregate quantities (don't list "onions" three times) |
| Chef says "I already have garlic and olive oil" | Exclude from list |
| Chef asks for a grocery list with no finalized menu | Agent asks which menu to use, or offers to help finalize one first |
| Very long grocery list (complex multi-course meal) | Still group by section. If it exceeds one screen, split into "essentials" and "full list" on request |

### Meal logging

| Scenario | Expected behavior |
|---|---|
| Chef logs a meal with no feedback | Save the meal with `null` feedback per dish. Don't ask for feedback — if they want to share it, they will |
| Chef gives vague feedback ("it went well") | Store as a general note on the meal, don't try to force per-dish ratings |
| Chef logs a meal days after cooking | Accept any past date. Confirm the date: "Logging this for Julia on March 20 — correct?" |
| Chef mentions they cooked something new that wasn't suggested by the agent | Log it normally. The agent doesn't own the menu — it's a collaborator, not a gatekeeper |

### Data integrity

| Scenario | Expected behavior |
|---|---|
| Chef tries to add a client with a name identical to an existing client | Ask for clarification before creating a duplicate |
| Chef removes a dietary preference ("actually Simone can eat gluten now") | Soft-delete or remove from `dietary_preferences`. Don't leave stale data influencing suggestions |
| Agent is unsure whether something is a preference or an allergy | Default to the safer interpretation (allergy) and confirm with the chef |

---

## Out of Scope for This Build

These are explicitly deferred. If the chef asks about any of these, the agent should acknowledge the request, say it's not available yet, and ask them to describe their use case.

- Receipt processing and expense tracking
- Invoice generation
- Schedule management (booking, availability, morning summaries)
- Client communication bridge (group chats, direct client interaction)
- External recipe source integration (NYT Cooking, etc.)
- Multi-chef support (only one chef in Phase 1, but schema supports it)
- Meal history analytics or reports
- Grocery list saving or sharing

---

## Implementation Notes

### Confirmation flow is non-negotiable
Every write operation (add client, update client, log meal) must be confirmed by the chef before persisting. This is a core behavioral requirement from the constitution.

### Fuzzy matching
Client lookup should use Postgres `pg_trgm` extension for trigram similarity. Good enough for Phase 1, no external search service needed.

### One brain, many hands
The orchestrator is the only LLM. Tools are pure Postgres reads and writes. Menu suggestions, grocery lists, freeform text parsing, and all other reasoning happen in the orchestrator's context — not in nested LLM calls inside tools. This means the system prompt must encode culinary expertise, constraint-handling logic, and output formatting conventions. When menu suggestions are too generic or grocery quantities are off, the fix is in the system prompt, not in tool code.

### Conversational state across message batches

This is the hardest unsolved design question in the spec.

The tools are stateless — correct. But the agent needs to resolve "her," "the Tuesday client," "that last dish" from conversation context. The Agents SDK handles multi-turn within a single invocation, but the message batching architecture means each batch could be a **new agent invocation**. The 20-second debounce groups rapid-fire texts into one batch, but the next batch (minutes or hours later) is a cold start.

What needs to persist between invocations:
- **Which client was last discussed** (for pronoun resolution: "her", "them")
- **What menu was being workshopped** (chef might finalize hours after the initial suggestions)
- **Recent tool calls and their results** (so the agent doesn't re-fetch or lose context)

Options to evaluate during implementation:

**Option A: Conversation history in Postgres.** Store the last N message pairs (user + assistant) per chef. Load them into the Agents SDK context at the start of each invocation. Simple, gives the agent everything it needs to resolve references, but context window cost grows linearly.

**Option B: Structured session state.** After each invocation, the agent writes a small state object: `{ active_client_id, active_menu, last_tool_calls }`. Next invocation loads the state and injects it as a system message. Cheaper on tokens but lossy — the agent only knows what was explicitly extracted.

**Option C: Hybrid.** Store the last 5-10 message pairs AND a structured state summary. The messages handle nuance ("she mentioned wanting something lighter"), the state handles hard references (active client ID). This is likely the right answer but needs to be validated against token budget and latency constraints.

Whichever approach is chosen, the messaging layer must pass a `conversation_id` or `chef_id` to the agent so it can load the right state. The debounce queue already groups by sender, so this is a natural extension.

**This must be resolved before implementation begins.** The rest of the spec works regardless of which option is picked, but tools like `get_client` implicitly depend on "the agent knows who we're talking about" — and that only works if conversational state survives between batches.

### System prompt carries the culinary expertise
Since the orchestrator handles menu suggestions and grocery lists directly (no tool delegation), the system prompt must include enough culinary knowledge and constraint-handling instructions for these workflows to be high quality. This means the system prompt is the single surface area for tuning agent behavior — both conversational tone and culinary reasoning. When suggestions are too generic, the fix is in the system prompt. Version and iterate it the same way you would application code.
