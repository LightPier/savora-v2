# Savora — Product Requirements Document

*Last updated: March 24, 2026*
*Status: Active development, Phase 1 (single user validation)*

---

## Problem

Private chefs have no purpose-built tools. They manage multiple household clients with complex dietary restrictions, preferences, schedules, and billing across phone notes, memory, ziplock bags of receipts, and scattered documents. Every other professional service category (plumbers, landscapers, real estate agents) has a CRM. Private chefs have nothing.

The operational overhead of running a solo chef business includes: tracking per-client preferences and allergies, remembering what was cooked to avoid repetition, collecting honest feedback from clients who are uncomfortable giving criticism, generating invoices across multiple pricing models, managing a schedule that mixes VIP regulars, flyby clients, and events across multiple cities, and communicating with clients who don't understand cooking and make unrealistic requests.

All of this work is non-physical. None of it is cooking. But it consumes hours every week and is where mistakes happen: wrong invoice amounts, forgotten allergies, repeated meals, missed scheduling conflicts, wasted food from not tracking preferences.

> "I really am flying by the seat of my pants... I track like, when I go to someone's house, what they didn't eat. What I'm throwing away. Because I hate throwing away food."

> "I invoiced everyone on Saturday and then I had a look at what I did, and the invoice that I sent to Tommy was like, I did four days in April, I invoiced him for eight days, but I forgot to change the last four days to May."


## Solution

Savora is a text-based AI assistant that handles everything a private chef does that isn't physical cooking. It lives in WhatsApp and SMS. There is no app. There is no dashboard. The CRM is invisible. The chef texts, the agent handles it.

The strategic insight: sell the assistant, not the software. Chefs don't want a CRM. They don't want an app with dropdowns and menus. They want a competent person at a desk who waits for their texts and handles things. We're building that person, digitally.

> "We're not selling them on the value props of a CRM. They're getting the function of the CRM with all the value props of the AI assistant."

> "Think of it like, you're an artist. You would have a private manager. The manager does everything for you."


## Target user

Solo private chefs managing 3-8 household clients with no business operations support. They handle everything from meal planning to invoicing alone.

**Profile:**
- Independent, creative professionals who view cooking as caretaking
- Communicate via text already, it's their natural medium for client interaction
- Not tech-savvy, actively resistant to complex software
- Work across multiple cities and client types (VIP regulars, flyby seasonal clients, events, retreats)
- Price differently per engagement: hourly for regular households, flat fee + groceries for events, daily rates for longer bookings, discounts for friends
- Track receipts in ziplock bags, preferences in their head, schedules on paper
- Spend significant unpaid hours on admin and hate every minute of it

> "I'm a stereotypical artist personality and I don't understand this world."

> "Cooking is a form of caretaking and that's why I do it. For a profession."

**Secondary segments (future):**
- Small chef services (10-25 clients, growing from solo to small team)
- Corporate/enterprise chefs (structured employment, predictable schedules)

Phase 1 focuses exclusively on solo chefs. The product must work for one chef before expanding.


## Core features

Five jobs the agent must do, in priority order based on frequency and pain level.

### 1. Client database (invisible CRM)

The foundation everything else depends on. Context capture through natural conversation, not forms.

**What it stores per client:**
- Name (however the chef refers to them, could be first name, household name, nickname)
- Contact details (only if the chef provides them, not required)
- Dietary preferences and restrictions (pescatarian, gluten-free, low sodium, etc.)
- Allergies (with severity if mentioned)
- Life events and personal context (birthdays, travel schedules, new baby, surgery recovery)
- Meal history (what was cooked, when, and any feedback)
- Feedback on previous meals (both direct and observed, e.g. "they didn't eat the salmon")
- Pricing arrangement (hourly rate, flat fee, special terms)
- Scheduling pattern (every Thursday, seasonal, event-based)
- Notes (pet names, kitchen layout, preferred stores, anything the chef wants to remember)

**Key behaviors:**
- The chef can add a client by sending a freeform text dump about them. The agent parses it into the right fields. No structured input required.
- The agent captures context passively from ongoing conversations. If the chef mentions "oh, Simone just had surgery," it updates the profile.
- When the chef asks "remind me about Simone," the agent surfaces relevant context without the chef having to specify what they need.
- Client lookup is conversational. The chef says "her" or "the Thursday family" and the agent resolves from recent context.

**Success metric:** Context retention accuracy. The agent remembers and correctly applies a client preference that was mentioned 3+ weeks ago.

### 2. Creative space (recipe and menu assistance)

This is the aha moment feature. The first thing that makes a chef say "holy shit, this is useful."

**Core flow:**
1. Chef says who they're cooking for (by name or reference)
2. Agent pulls that client's preferences, restrictions, allergies, and meal history
3. Agent suggests menu ideas that respect all constraints, avoid recent repetition, and offer variety
4. Chef workshopping back and forth ("what about something with lamb?" / "she doesn't eat red meat" / "right, okay, fish then")
5. Agent generates a grocery list organized by store section (produce, proteins, dairy, pantry, etc.)

**Key behaviors:**
- Proactively suggest the grocery list after menu finalization. This was the product's first wow moment.
- Pull from the chef's preferred recipe sources when known (e.g. Georgie uses New York Times Cooking)
- Factor in what the chef already has (if they mention pantry items)
- Suggest variations the chef wouldn't think of. "Suggested 5 new variations I never would have thought of."
- Track inspiration sources. If a client shares a recipe or the chef finds one they like, store it in the client's profile.

**Success metric:** Chef uses the creative space flow before every cooking session instead of planning from memory.

### 3. Receipt processing and expense tracking

Chefs pay out of pocket for groceries and need to track expenses against each client for invoicing and tax purposes.

**Core flow:**
1. Chef takes a photo of a receipt and texts it to the agent
2. Agent extracts total and date via LLM-based OCR
3. Agent asks which client the receipt is for (or infers from recent context)
4. Agent confirms: "Got it. $127.43 for Simone on March 22. Added to her March expenses."
5. Receipts accumulate per client per billing period

**Key behaviors:**
- Receipt photos are processed by the LLM directly, no separate OCR service needed
- Always confirm the extracted details. If the date or total is unclear, ask. This is an engagement point, not a failure.
- Link every receipt to a specific client. No unattached receipts floating in the system.
- Support a "research" category for the chef's personal expenses (grocery runs for R&D, dining out) for tax write-off tracking
- Handle crinkled, handwritten, and low-quality receipt photos gracefully. If it can't read it, ask.

**Success metric:** Chef sends receipt photos on the same day as the shopping trip, not weeks later in a batch.

### 4. Invoice generation

Turn accumulated receipts, hours worked, and pricing arrangements into a professional invoice.

**Core flow:**
1. Chef says "generate invoice for Simone for March"
2. Agent pulls: all receipts linked to Simone in March, hours logged, pricing arrangement (hourly rate, flat fee, etc.)
3. Agent generates a summary and asks for confirmation
4. Agent produces a PDF invoice the chef can forward to the client
5. Track invoice status (sent, paid, outstanding)

**Key behaviors:**
- Support multiple pricing models per client: hourly, flat fee, flat fee + groceries, daily rate, custom discounts
- Separate grocery costs from labor in the invoice (chefs need to see their actual profit)
- Track outstanding invoices and surface gentle reminders ("You have 2 unpaid invoices totaling $1,850")
- Handle the chef's actual workflow: they don't invoice the day they cook. They batch it weekly or monthly.
- Hours can be logged after the fact. "I cooked for Simone for 6 hours yesterday."

**Success metric:** Invoice generation drops from hours of manual work to under 5 minutes of texting.

### 5. Schedule management

Internal calendar with conversational access. No external calendar integrations for now.

**Core flow:**
1. Chef texts "am I free next Thursday?"
2. Agent checks and responds with availability
3. Chef says "book Simone for Thursday at 10am"
4. Agent confirms and adds to schedule

**Key behaviors:**
- Morning summary: text the chef what's on their schedule today, including client context ("Cooking for Simone today. Reminder: she's recovering from surgery, focus on anti-inflammatory and easy to digest.")
- Support recurring bookings ("I cook for Tomas every Thursday")
- Handle rescheduling conversationally ("I can't see my Wednesday client for the next 3 weeks, I'll be back October 8th")
- Track VIP vs flyby vs event clients differently. VIPs get priority, flybys are flexible, events block off multiple days.
- Evening check-in option for chefs who want to log hours and debrief at end of day

**Success metric:** Chef checks schedule via agent instead of a paper diary or phone calendar.


## Client communication bridge

This is not a standalone feature but a capability that runs across all five jobs. The agent helps the chef communicate with clients who don't understand cooking.

**Phase 1 (current):** Chef-facing only. The agent helps the chef draft responses, explains constraints in client-friendly language, and provides talking points. The chef always controls what goes out.

**Phase 2 (future):** The agent lives in group chats with the chef and their clients. It can directly respond to clients on the chef's behalf: sending scheduling confirmations, following up on invoices, asking about preference changes, and translating cooking concepts into plain language. The chef maintains override control.

> "A lot of people who hire private chefs, they don't cook. That's a very large part of decision making that most people who can't cook will stop right there. That's too much for them."

The agent's role here is to be the bridge between expert and non-expert, the same way a good office manager translates between a specialist and their clients.


## Agent behavior requirements

### Message handling
Users text like they talk to a person. Messages arrive in bursts (multiple texts in rapid succession), mixed with personal details, anecdotes, and multiple requests jumbled together.

The messaging layer batches incoming texts: 20-second debounce after the last message, incrementing by 15 seconds per additional message, until the person stops typing. The agent receives one consolidated input, not fragments.

### Confirmation before action
When a message contains multiple requests or ambiguous instructions, the agent must:
1. Parse the message into distinct tasks
2. Map each task to the relevant job (CRM update, schedule change, receipt log, etc.)
3. Present the parsed tasks back to the chef for confirmation
4. Only execute after approval or adjustment

This is non-negotiable. Chefs add anecdotal context ("I'm traveling for my birthday") mixed with actionable requests ("move my Wednesday client to October 8th"). The agent must separate signal from context and confirm it got the right tasks.

### Tone
- Concise: SMS. Every word must earn its space. Use symbols over words. No filler, no walls of text.
- Expert: Respond as a knowledgeable counterpart who understands cooking, ingredients, dietary needs. Never give generic or intern-level answers.
- Warm but not effusive: like a competent coworker, not a chatbot. Casual, not formal.
- Situationally proactive: suggest next steps only when the context clearly calls for it (grocery list after menu finalization). Do not randomly surface suggestions.
- Never make the chef feel stupid: no jargon, no technical terms, no asking them to format inputs differently.

### Escalation
If a request falls outside the five core jobs, the agent should:
1. Acknowledge the request
2. Explain it's not a current capability
3. Ask the chef to describe the use case and what they're trying to accomplish
4. Log the request as a feature suggestion for the team

No dead ends, but no overpromising either.


## Core loop and retention

**Core loop:** Daily context capture + creative space assistance. These two have the highest frequency (daily) and highest pain (HIGH). They create compounding value because every interaction makes the agent smarter about the chef's clients.

**Aha moment:** The agent remembers a client preference the chef mentioned weeks ago and applies it without being asked when suggesting a menu or generating a grocery list.

**Habit formation sequence:**
- Day 1: Chef adds first client to the system
- Day 3: First contextual response (agent applies stored preferences without prompting)
- Week 1: 3+ interactions where the agent "remembered" something useful
- Week 2: Chef mentions specific value ("it remembered Julia's low sodium thing from three weeks ago")
- Month 1: Chef opens the agent instead of phone notes as default behavior

**Switching cost moat:** The more client context captured, the harder it is to switch. After 3 months of meal logs, preference updates, and receipt history, the agent knows more about the chef's clients than the chef's own memory does.

**Key metrics:**
- Interaction frequency (target: 3-4x per week minimum)
- Number of distinct jobs used per week (target: 3+ of the 5)
- Context retrieval accuracy (does it remember and apply correctly?)
- Unprompted value moments (proactive suggestions that the chef acts on)


## Business model

Per-chef monthly subscription. Pricing not yet validated.

No affiliate revenue, no ingredient sourcing commissions. Pure subscription. The value prop is time saved and context retained, not product recommendations.

Willingness-to-pay research needed with additional chef interviews. Anchor against: what would you pay a part-time virtual assistant to do this work? That's the pricing ceiling.


## Go-to-market

**Phase 1: Georgie (current)**
Single user. Manual onboarding via direct relationship. Goal: daily habit formation and core loop validation. No marketing, no growth, just make it work for one person.

**Phase 2: Georgie's network (next)**
Access her network of chef friends in Bozeman and California. She's well-connected and viewed as a credible voice in the local chef community. Manual onboarding for each (interview, extract preferences, configure). Target: 10 chefs.

> "She can basically validate the people and the use cases for us. We don't need to do anything. Because she's gonna know who she wants to refer us to."

**Phase 3: Chef networks and services**
Go deeper in the chef vertical. Target small chef services (10-25 clients) where the coordination pain is even worse. This is the next segment after solo chefs.


## Tech stack

- **Messaging:** WhatsApp via WAHA (Georgie), Twilio for future SMS users and group chat functionality. Each chef is an independent chat thread.
- **Agent orchestration:** Anthropic Agents SDK, TypeScript. The orchestrator is the single reasoning layer. Tools are pure data operations (read/write Postgres). The orchestrator reasons about what to do, calls data tools, reasons about results, responds. No nested LLM calls inside tools. "Suggest a menu" is the orchestrator using `get_client` data plus its own culinary knowledge, not a separate tool with its own LLM call.
- **Database:** Postgres via Supabase. Structured client data, receipts, invoices, schedule.
- **Memory:** Conversational context beyond structured CRM fields. Approach TBD, evaluate within Agents SDK capabilities.
- **OCR:** LLM-based receipt processing. No separate OCR service.
- **Language:** TypeScript only. No Python. No n8n. No no-code.
- **Message batching:** Debounce queue before agent processing. 20-second initial wait, +15 seconds per additional message.


## Open questions

- What is the right subscription price point? Need willingness-to-pay research.
- How should the agent onboard a chef's clients? (Text-based questionnaire? Temporary web form? Just let context accumulate naturally?)
- What's the exact boundary between structured CRM data and conversational memory?
- How do the five core jobs map to conversational workflows? (Tools are data operations. The jobs are orchestrator behaviors that use tools. The spec for each feature defines which tools the workflow needs.)
- At what client volume do manual processes completely break down for chefs? (This determines when to target the small chef services segment.)
- How should group chat interactions work when the agent eventually talks directly to clients?


## Development phases

**Phase 1: Core loop validation (current)**
Build: Creative space + CRM (co-dependent), receipt processing, invoice generation, schedule management. For one user. In WhatsApp. Until she uses it 3-4x per week without handholding.

**Phase 2: First 10 users**
Manual onboarding per chef. Formalize system prompt and tool configurations based on learnings from Georgie. Likely introduce SMS/Twilio path for US-based chefs. Begin tracking retention and engagement metrics.

**Phase 3: 10-100 users**
Self-serve or semi-automated onboarding. Lightweight web experience for initial setup. Begin pricing validation and subscription billing. Evaluate group chat functionality for chef-client communication.

---

*This PRD is the product companion to CLAUDE.md (the constitution). The constitution defines how we build and how the agent behaves. This document defines what we build and why. Both should live in the repo root and be read by any agent working on the codebase.*