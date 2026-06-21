# ForemanAI — Demo Script

**Target time: 3 minutes.** Practice it twice. The ArmorIQ block in step 4 is your anchor moment — confirm it fires before going live.

---

## Before you present

1. Start all services: `bash scripts/start.sh` (from project root)
2. Run the rehearsal: `python3.11 scripts/demo_flow.py`
3. Confirm `template_filled present: True` and `vendor_email_draft present: True` in output
4. Have Phoenix open at http://localhost:6006
5. Have the frontend open at http://localhost:5173

---

## The pitch (say this before touching anything)

> "My dad is a contractor. He doesn't want to do invoices. My stepmom doesn't either. Nobody in the trades does -- but it's the last thing between finishing a job and getting paid, so you have to. You do it tired, from memory, and you get it wrong. ForemanAI takes a raw work request and moves it all the way to a ready-to-send invoice. A human approves every step. That's it."

---

## Step 1 — Intake (~30 sec)

**Do:** Paste the raw request into the frontend, or show demo_flow.py step 1 output.

Raw request to use:
```
Repair the HVAC unit at 142 Elm Street. The compressor is making a grinding noise
and the system stopped cooling yesterday. Client: Riverside Property Management. Urgency: high.
```

> "This is the kind of message someone actually sends. No structure, no form. The intake agent reads it, pulls out job type, client, urgency, completeness -- and writes that into a shared work-order object in Redis. Every agent downstream reads from that object. None of them call each other directly."

**Show:** The classified JSON / work order status updating in the UI.

---

## Step 2 — Scheduling (~30 sec)

**Do:** Click approve on intake. Show scheduling output.

> "Scheduling picks time slots, writes a draft message to the client, and estimates what parts you'll probably need -- compressor, refrigerant, capacitor -- with price ranges. Nothing goes out until a human approves."

**Show:** The outreach draft and parts suggestion in the work order.

---

## Step 3 — Invoicing gap-fill (~45 sec) — the main event

**Do:** Show invoice-chat turn 1 (agent asking for missing fields).

> "The invoicing agent already knows the job, the parts, the client. It asks for what's actually missing: labor rate, hours on site, trip charge. That's it. Not a form -- just the gaps."

**Do:** Show invoice-chat turn 2 response -- consistency flag fires.

> "Here's the part worth watching. We gave it $140/hr. The agent checks that against past invoices for this job type -- the average is $98. It flags it: LABOR_RATE_HIGH. It doesn't stop you. It just puts it in front of you and lets you decide. That's the consistency check."

---

## Step 4 — ArmorIQ block (~30 sec) — the showstopper

**Do:** Trigger a `DEMO_BLOCK` action in the invoice chat. Send the message `"DEMO_BLOCK"` in the invoice chat UI, or point to the ArmorIQ block output from the demo_flow run.

> "Before the agent can commit anything -- fill the template, draft the email -- ArmorIQ checks it against the approved plan. Watch what happens when we send something that wasn't in the plan."

**Show:** The block response / ArmorIQ overlay firing.

> "Blocked. The agent can't proceed. This isn't a system prompt asking it nicely to behave -- the action physically can't go through without clearance. That's runtime enforcement."

---

## Step 5 — Approval + output (~20 sec)

**Do:** Click the human approval button. Show the rendered invoice and vendor email draft.

> "Human approves. Invoice comes out clean, branded, consistent with past invoices. Vendor email is drafted and waiting. Nothing left the system without a person saying so."

---

## Close (~15 sec)

**Do:** Switch to Phoenix at http://localhost:6006.

> "Every decision is in here -- the gap-fill turns, the consistency check, the ArmorIQ block. You can see exactly what the agent was looking at and why."

**Then:**

> "Your dad didn't go into contracting to sit at a kitchen table at 9pm trying to remember if he charged for the refrigerant. That's what this is for."

---

## Sponsor callouts (weave in naturally, don't list them)

These are the actual mechanisms -- use them if a judge asks how it works, or weave them into the narration at the right moment.

| Sponsor | What we actually use | Where to point |
|---|---|---|
| **Anthropic** | `claude-sonnet-4-6` via the Anthropic SDK with tool use. All three agents run an agentic loop -- they call tools, get results back, decide what to do next. Not a single prompt-and-response, a real loop. | The gap-fill conversation in step 3 is the clearest example of the loop in action. |
| **Redis** | Two things: the work-order object is stored as JSON in Redis and every agent reads/writes it directly -- that's how they coordinate without calling each other. The invoice history is a vector index in Redis Stack -- the consistency check does a similarity search against past invoices to flag rate anomalies. | Step 3, when LABOR_RATE_HIGH fires -- that flag comes from a Redis vector search, not a hardcoded rule. |
| **ArmorIQ** | `sign_plan` registers the approved plan at the start of the invoicing session. `check_action` runs before every committing action -- fill template, draft email. If the action isn't in the signed plan, it blocks. DEMO_BLOCK is hardwired to always trigger a block so we can show it reliably. | Step 4. If a judge wants to see the code, `backend/agents/armoriq_client.py`. |
| **Arize Phoenix** | `openinference.instrumentation.anthropic` auto-instruments every Claude API call -- input, output, token count, latency. On top of that we add manual spans for `invoicing.gap_fill_turn`, `invoicing.consistency_check`, and `invoicing.armoriq_check` with custom attributes like `flags_count` and `turn_number`. Every span links back to the work order via `trace_id`. | The close. Switch to http://localhost:6006 and show the span tree for the invoicing session. |

---

## If something breaks

- **Backend down:** Show the demo_flow.py terminal output -- it's the full flow in text
- **Phoenix empty:** Explain the trace_id is in the work-order object and Phoenix shows it on a real run
- **ArmorIQ block doesn't fire:** Describe it verbally and show the armoriq_client.py stub -- "the hook is here, wired to every committing action"
- **Frontend not ready:** Run everything from the terminal, narrate what each response means
