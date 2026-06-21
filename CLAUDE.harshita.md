# CLAUDE.harshita.md (Person A: front of the lifecycle)

Read `CLAUDE.md` (root) first. This file fences your role. You own the front of the lifecycle: intake, scheduling, and the parts suggestion. These are leaner than invoicing by design, which is why you also own making them look as finished in the demo as the invoicing stage.

## You own

### 1. Intake agent
Reads the original unstructured request and turns it into structured data the rest of the pipeline can use.
- Classify the job type.
- Extract the relevant entities (who, what, where).
- Judge completeness: flag what is missing before this becomes a real work order.

Writes the `classification` section of the work-order object. Reads `raw_request`.

### 2. Scheduling agent
Takes the classified job and proposes how to schedule it.
- Reason over availability and job urgency to propose workable times. Make this a real reasoning step, not a calendar lookup. Urgency triage and conflict handling are what make it an agent.
- Draft outreach to the customer to confirm timing (text or email draft, no live send, no live call).

Writes the schedule fields of the work-order object. Reads `classification`.

### 3. Parts suggestion (the honest-guess feature)
A small, labeled extra inside scheduling. Not a full agent.
- Given the job type, suggest parts that might be needed, clearly labeled as a guess ("You may need these parts for this job...").
- Pull likely parts from the Redis history the spine exposes.
- If Browserbase is wired and time allows, attach rough local pricing. This MUST fall back to seeded prices on any failure. A failed pricing call cannot break anything.

### 4. Make the front stages demo-finished
The demo walks all three stages. Intake and scheduling are lean in logic but must not look unfinished in the UI. Coordinate with the Designer so these stages render as polished as invoicing.

## You must NOT
- Build the invoicing agent. That is Eugene.
- Build a live phone call or live send into scheduling. Drafts only.
- Let the parts suggestion grow into a full procurement agent with diagnosis loops and quantities. That is roadmap. Keep it a labeled one-shot suggestion.
- Write another agent's section of the work-order object.

## Guardrails for your Claude Code session
- The classification and urgency-triage reasoning are yours to work out. This file sets up the problem, it does not solve it.
- Build against the locked work-order schema. Read only the sections before yours, write only your own.
- You are predicted to finish first because these stages are leaner. When you do, you roll into integration with Person B. Plan for that.
- Emit Arize traces for your agents' decisions.

## Done looks like
A seeded request flows through intake (classified, completeness flagged) into scheduling (times proposed, outreach drafted, parts suggested and labeled), and the enriched work-order object is ready for invoicing to pick up. All three render cleanly in the UI.

## Task list

### Intake agent
- [x] Boilerplate: `classify_job` tool, system prompt, single-turn call (`backend/agents/intake_agent.py`)
- [x] Arize Phoenix instrumentation at module level
- [x] Fallback to stub classification on any exception
- [x] Test with a seeded `raw_request` — confirmed via demo_flow.py (HVAC job type, location/urgency/contact extracted, completeness flags correct)
- [x] Test fallback path — covered by `test_intake_agent.py::test_fallback_on_exception`
- [ ] Verify Arize span appears in Phoenix UI for each intake call — code wired, visual confirmation pending

### Scheduling agent
- [x] Boilerplate: 3 tools (`propose_times`, `draft_outreach`, `suggest_parts`), agentic loop (`backend/agents/scheduling_agent.py`)
- [x] Seeded prices dict + `_apply_seeded_prices` post-processing
- [x] System prompt enforces `ESTIMATED PRICE -` label on every part reason
- [x] Fallback to stub schedule on any exception
- [x] Test with a seeded classification — covered by `test_scheduling_agent.py::test_three_tools_in_one_loop`
- [x] Confirm seeded prices override Claude's guesses — covered by `test_scheduling_agent.py::test_seeded_prices_override_guess`
- [x] Confirm parts suggestion reason always starts with `ESTIMATED PRICE -` — covered by `test_scheduling_agent.py::test_estimated_price_label_default`
- [ ] Verify Arize span appears in Phoenix UI — code wired, visual confirmation pending

### Integration (stage two — you finish first, then join Bhoomika)
- [x] Confirm `run_intake` + `run_scheduling` wired correctly in `backend/orchestration/pipeline.py`
- [x] Run intake → scheduling end-to-end: seeded request in, enriched work-order object out in Redis
- [ ] Coordinate with Michelle so intake and scheduling screens render the real agent output cleanly — pending Michelle's UI
