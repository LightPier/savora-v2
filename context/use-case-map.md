# Savora — Use Case Map

*Last updated: March 24, 2026*
*Companion to: CLAUDE.md (constitution), prd.md*

---

## Overview

Savora addresses the operational overhead that private chefs carry outside of physical cooking. Context management is the #1 pain point. The communication gap between chefs and non-cooking clients is the key differentiator. The core loop centers on daily context capture and creative assistance, supported by weekly scheduling and monthly invoicing.

Two user segments within the chef vertical, prioritized by pain level and our ability to reach them.


## User segments

### Solo personal chefs (Phase 1 target)

**Who:** Independent chefs managing 3-8 household clients with no business ops support.

**Context:** Use notes on phone, manual documents, memory, and ziplock bags of receipts. Spend significant unpaid hours on admin. Handle everything from meal planning to invoicing alone. Communicate with clients via text.

**Tech comfort:** Prefer simple, invisible tools. Already live in WhatsApp/SMS. Don't want apps with buttons and menus. "I'm a stereotypical artist personality and I don't understand this world."

**Volume:** 3-8 active households, 10-20 meals per week, monthly invoicing. Mix of VIP regulars, flyby seasonal clients, and events across multiple cities.

### Small chef services (Phase 3 target)

**Who:** Chef businesses scaling from solo to small team, managing 10-25 clients.

**Context:** Some business processes in place but overwhelmed by growth. Need better systems to avoid breaking at scale. May have an assistant or sub-chef they need to hand context to.

**Tech comfort:** More willing to adopt structured tools but still prefer communication-based interfaces.

**Volume:** 10-25 active clients, 30-60 meals per week, potential for recurring schedules and team coordination.


## Use case map — solo personal chefs

### Core loop use cases (daily, HIGH pain)

**Context management: Client preferences evolve constantly**
- Trigger: Client mentions new allergy, preference change, life event, or special occasion
- Current alternative: Notes on phone, memory, scattered documents
- Desired outcome: Agent automatically captures, stores, and applies context in future interactions without being asked
- Frequency: Daily
- Pain level: HIGH
- Aha moment: "It remembered Julia's low sodium requirement from 3 weeks ago"

**Creative space: Menu planning and grocery lists**
- Trigger: Chef needs to plan meals for a client session, is at the store, or is stuck for inspiration
- Current alternative: Memory, manual planning, browsing recipe sites alone
- Desired outcome: Agent pulls client preferences and history, suggests menu ideas, generates a grocery list organized by store section
- Frequency: Per-meal (effectively daily for active chefs)
- Pain level: HIGH
- Aha moment: "It created a perfect grocery list organized by aisle for 3 clients this week, and it even suggested variations I never would have thought of"

### Supporting use cases (weekly/monthly, MEDIUM-HIGH pain)

**Receipt processing and expense tracking**
- Trigger: Chef finishes shopping, gets a receipt
- Current alternative: Ziplock bags labeled with client names, manual tallying at month end
- Desired outcome: Photo the receipt, agent extracts total and date, links to correct client, accumulates for invoicing
- Frequency: Per-shopping-trip (multiple times per week)
- Pain level: MEDIUM-HIGH
- Aha moment: "I just texted my receipts and it tracked everything. No more ziplock bags."

**Invoice generation**
- Trigger: End of billing period, chef needs to bill clients
- Current alternative: Manual invoice creation in documents, frequent errors, hours of work
- Desired outcome: Agent generates a PDF invoice from accumulated receipts, logged hours, and the client's pricing arrangement
- Frequency: Monthly or biweekly
- Pain level: MEDIUM-HIGH
- Aha moment: "Invoicing used to take me half a Saturday. Now it's a 5-minute text conversation."

**Schedule management**
- Trigger: Client needs to reschedule, chef needs to check availability, morning planning
- Current alternative: Paper diary, phone calendar, manual coordination via text
- Desired outcome: Agent manages an internal calendar, handles rescheduling conversationally, sends morning summaries with client context
- Frequency: Weekly
- Pain level: MEDIUM
- Aha moment: "I woke up and had a text telling me exactly who I'm cooking for today and what to keep in mind for each of them"

### Expansion use cases (builds value over time)

**Meal history and variety tracking**
- Trigger: Chef needs inspiration, client wants variety, chef is repeating meals
- Current alternative: Memory, no tracking of what was cooked when
- Desired outcome: Agent tracks every meal cooked per client, suggests new ideas based on history, flags when it's been too long since a favorite or too repetitive
- Frequency: Daily (as meal logging becomes habit)
- Pain level: MEDIUM
- Aha moment: "It told me I haven't made that carrot harissa bowl Simone loved in 6 weeks and suggested a seasonal variation"

**Client communication bridge (Phase 2: direct client interaction)**
- Trigger: Client makes unrealistic request, needs scheduling confirmation, or hasn't paid an invoice
- Current alternative: Chef handles all client communication directly, often frustrated by clients who don't understand cooking
- Desired outcome: Agent eventually operates in group chats, responds to clients directly on chef's behalf for scheduling, follow-ups, preference gathering, and gentle invoice reminders. Chef maintains override control.
- Frequency: Per-client-interaction
- Pain level: HIGH (for chef), but implementation complexity is also high
- Aha moment: "The agent handled all the back-and-forth with Katie about what to cook this week. I just showed up and cooked."


## Core loop analysis

The core loop is context management + creative space. These two use cases have the highest frequency and highest pain. They also create compounding value: every interaction makes the agent's knowledge richer, which makes the next interaction more useful.

**Why this drives retention:**
- Value compounds over time. After 3 months, the agent knows more about the chef's clients than the chef can keep in their head.
- Each interaction is a deposit into a growing context bank that becomes irreplaceable.
- The creative space flow produces visible, immediate value (organized grocery lists, smart menu suggestions) that reinforces the habit.

**Supporting use cases prevent churn:**
- If invoicing doesn't work, the chef needs another tool and starts drifting away.
- If scheduling is unreliable, they lose trust in the agent for all tasks.
- These need to be good enough, not excellent. The core loop needs to be excellent.

**Expansion use cases grow lifetime value:**
- Meal history tracking turns a useful tool into an indispensable one.
- Client communication bridge expands the agent from chef-only tool to a relationship management layer.


## Activation sequence

Goal: Get the chef to their first context memory aha moment within the first week.

**Step 1:** Chef texts the agent, completes lightweight onboarding (name, business description, location, hourly rate). Under 2 minutes.

**Step 2:** Agent prompts chef to add their first client. Chef can send a freeform text dump or fill in the structured fields. Either works.

**Step 3:** Within the first session, chef asks for help with that client (menu ideas, grocery list, or "remind me what their restrictions are"). Agent applies the stored context correctly.

**Step 4:** Aha moment. The agent demonstrates it remembers and can use the context the chef deposited. Chef realizes this replaces their phone notes.

**Step 5:** Chef adds remaining clients over the next few days as they cook for each one. The habit builds around actual work, not a setup session.

**Success milestones:**
- Day 1: First client added
- Day 3: First contextual response (agent applies stored preferences)
- Week 1: 3+ interactions showing the agent "remembered" something
- Week 2: Chef mentions specific value unprompted
- Month 1: Agent is the default tool, not phone notes


## Priority matrix

| Use case | Frequency | Pain level | Strategic role | Build phase |
|---|---|---|---|---|
| Context management (CRM) | Daily | HIGH | Core loop | Phase 1 |
| Creative space (menu + grocery) | Daily | HIGH | Core loop | Phase 1 |
| Receipt processing | Per-trip | MEDIUM-HIGH | Supporting | Phase 1 |
| Invoice generation | Monthly | MEDIUM-HIGH | Supporting (defense) | Phase 1 |
| Schedule management | Weekly | MEDIUM | Supporting (defense) | Phase 1 |
| Meal history and variety | Daily | MEDIUM | Expansion (offense) | Phase 2 |
| Client communication bridge | Per-interaction | HIGH | Expansion (offense) | Phase 2-3 |


## Evidence base

### Strong evidence (from transcripts and user observation)
- Context management is #1 pain point (multiple sessions, consistent)
- Client communication gap exists and causes real frustration (Georgie examples of frozen roasts, unrealistic requests)
- WhatsApp/SMS is the preferred and only acceptable interface (Georgie actively resists any app or dashboard)
- Manual processes are painful and error-prone (invoicing errors, receipt ziplock bags, forgotten preferences)
- Grocery list generation was the first genuine wow moment (unprompted, in-context, immediately useful)
- Proactive suggestions work when contextually appropriate, annoy when random
- Chefs text like they talk to a person (anecdotal, multi-request, personal details mixed in)

### Validated through building
- Single conversation endpoint can't handle the five jobs, need proper tool routing (Agents SDK)
- Message batching/debouncing is required, users send rapid-fire texts
- Receipt OCR via LLM is good enough for clean receipts, needs confirmation flow for damaged ones
- No-code tooling (n8n) hits a ceiling fast, TypeScript is the right path

### Needs more research
- Willingness to pay by segment
- At what client volume do manual processes completely break down
- How the agent should handle direct client communication in group chats
- Optimal approach for onboarding a chef's clients (text-based? web form? natural accumulation?)

---

*This use case map drives feature prioritization and development sequencing. Reference the PRD for feature specifications and the constitution (CLAUDE.md) for behavioral requirements and tech stack decisions.*