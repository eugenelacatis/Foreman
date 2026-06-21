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

> "Field service businesses — HVAC, plumbing, electrical — run on paper. A technician finishes a job and the invoice might not go out for days. ForemanAI changes that. Drop in a raw work request — the kind of thing someone texts you — and the system takes it the whole way to a ready-to-send invoice. But a human approves every step. That's the thesis."

---

## Step 1 — Intake (~30 sec)

**Do:** Paste the raw request into the frontend, or show demo_flow.py step 1 output.

Raw request to use:
```
Repair the HVAC unit at 142 Elm Street. The compressor is making a grinding noise
and the system stopped cooling yesterday. Client: Riverside Property Management. Urgency: high.
```

> "This is the kind of request we actually get. No structure, no form. The intake agent classifies it — job type, client, urgency, completeness flags — and writes that into a shared work-order object in Redis. Every agent downstream reads from that object. None of them call each other directly."

**Show:** The classified JSON / work order status updating in the UI.

---

## Step 2 — Scheduling (~30 sec)

**Do:** Click approve on intake. Show scheduling output.

> "Scheduling proposes time slots, drafts a client outreach message, and suggests parts likely needed — compressor, refrigerant, capacitor — with estimated prices. Nothing goes out until a human approves."

**Show:** The outreach draft and parts suggestion in the work order.

---

## Step 3 — Invoicing gap-fill (~45 sec) — the main event

**Do:** Show invoice-chat turn 1 (agent asking for missing fields).

> "Here's where it gets interesting. The invoicing agent prefills everything it can from the work order — parts, quantities, job description. Then it asks only for what's genuinely missing: labor rate, hours on site, trip charge. It's a conversation, not a form."

**Do:** Show invoice-chat turn 2 response — consistency flag fires.

> "Watch this. We gave it a $140/hr labor rate. The agent checks that against past invoices for this vendor type — the average is around $98. It flags it: LABOR_RATE_HIGH. That's the consistency check. It doesn't block the user — it surfaces the anomaly for a human to decide on."

---

## Step 4 — ArmorIQ block (~30 sec) — the showstopper

**Do:** Trigger a `DEMO_BLOCK` action in the invoice chat. Send the message `"DEMO_BLOCK"` in the invoice chat UI, or point to the ArmorIQ block output from the demo_flow run.

> "Before the agent can fill the template or draft the vendor email, ArmorIQ checks the action against the approved plan. If something is off-plan — we can show that right here — it blocks. The agent cannot commit without clearance. This is runtime enforcement, not just a prompt telling it to be careful."

**Show:** The block response / ArmorIQ overlay firing.

---

## Step 5 — Approval + output (~20 sec)

**Do:** Click the human approval button. Show the rendered invoice and vendor email draft.

> "Human approves. Invoice renders — branded, consistent, complete. Vendor email is drafted and ready. Nothing was sent. Nothing was committed without a person making the call. The agent did the hard work; the human made the decision."

---

## Close (~15 sec)

**Do:** Switch to Phoenix at http://localhost:6006.

> "Every decision the system made is traced in Arize Phoenix — gap-fill turns, the consistency check, the ArmorIQ gate. You can see exactly what the agent was thinking and when."

**Then:**

> "This is what AI for the trades looks like. Not replacing the worker — giving them their evenings back."

---

## Sponsor callouts (weave in naturally, don't list them)

| Sponsor | Where it shows up |
|---|---|
| **Anthropic** | Every agent decision — intake, scheduling, invoicing |
| **Redis** | "The shared work-order object lives in Redis — that's how four agents coordinate without calling each other" |
| **ArmorIQ** | The block moment in step 4 |
| **Arize Phoenix** | The trace dashboard in the close |

---

## If something breaks

- **Backend down:** Show the demo_flow.py terminal output — it's the full flow in text
- **Phoenix empty:** Explain the trace_id is in the work-order object and Phoenix shows it on a real run
- **ArmorIQ block doesn't fire:** Describe it verbally and show the armoriq_client.py stub — "the hook is here, wired to every committing action"
- **Frontend not ready:** Run everything from the terminal, narrate what each response means
