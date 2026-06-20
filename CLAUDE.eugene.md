# CLAUDE.eugene.md

Read `CLAUDE.md` (root) first. This file fences your role. You own two things: the invoicing agent (the deep one) and the integration spine.

## You own

### 1. The invoicing agent
The deepest agent in the system. It reads the work-order object after scheduling has enriched it, and produces a complete, verified vendor invoice plus a draft email.

What it has to do:
- Prefill an invoice from the work-order data already in the object, so it starts mostly complete, not blank.
- Identify what is still missing (rates, trip charge, quantities, whatever the template needs that the work order does not contain).
- Run a short back-and-forth with the user, in natural language, to fill only the gaps. Not a form, a conversation that ends when the invoice is complete.
- Check the draft against past invoices for that vendor (read the invoice-history search the spine exposes) for consistency in formatting, line items, and rate sanity. Flag anything off.
- Fill OUR branded invoice template. Not a copy of the user's personal style. Professional by default.
- Present the draft for human verification. Nothing commits without it.
- On approval, draft the vendor email to the vendor who requested the work. Stop at draft. No send.

You write only the `invoice` section of the work-order object. You read `raw_request`, `classification`, and `schedule`.

### 2. The integration spine (shared with Person B)
- Lock the work-order schema in the first 90 minutes with Person B and the team. This is your highest priority before any agent code.
- Own the FastAPI app and the OpenAPI contract everyone builds against.
- Coordinate the async orchestration that advances the work order through stages.
- Stage two: lead final integration alongside Person B.

## You must NOT
- Build the intake or scheduling agents. That is Person A.
- Build the UI. That is the Designer.
- Auto-approve anything to smooth the demo. The human gate is the thesis.
- Build procurement, live send, or payments.

## Guardrails for your Claude Code session
- The invoicing conversation logic and consistency-checking are the hard, interesting part. Reason through them yourself. This file does not hand you the solution.
- Wrap your agent's committing actions with ArmorIQ so the off-plan block can be demoed on the invoicing step.
- Emit Arize traces for each agent decision.
- Build the gap-fill and consistency check to degrade to seeded invoice history if the search is not ready yet, so you are never blocked waiting on the spine.

## Done looks like
A seeded work order flows in, the agent prefills and runs a real gap-fill conversation, checks consistency, presents a branded draft, waits for human approval, and produces a vendor email draft. ArmorIQ blocks a deliberately off-plan action. Every step traces in Arize.

## Task list

### Spine (do first, blocks everyone)
- [x] Lock work-order schema with Bhoomika (`backend/models/work_order.py`)
- [x] Stand up FastAPI app with CORS and `/health` (`backend/main.py`)
- [x] Define all API routes and OpenAPI contract (`backend/api/routes.py`)
- [x] Wire pipeline orchestration with gate logic (`backend/orchestration/pipeline.py`)

### Invoicing agent
- [x] Boilerplate: tool definitions, system prompt, agentic loop (`backend/agents/invoicing_agent.py`)
- [x] ArmorIQ stub — `sign_plan` / `check_action`, `DEMO_BLOCK` trigger (`backend/agents/armoriq_client.py`)
- [x] Branded invoice template + `render_template` (`backend/agents/invoice_template.py`)
- [x] Seeded invoice history (`backend/seeds/invoice_history.py`)
- [x] Test gap-fill loop end-to-end with a seeded work order — confirm it asks the right questions
- [x] Test consistency check — seed a high-rate invoice and confirm the flag fires
- [x] Test ArmorIQ block — call with `action="DEMO_BLOCK"` and confirm the overlay-triggering response
- [x] Wire `POST /work-orders/{id}/invoice-chat` into the full pipeline flow and confirm state persists in Redis
- [x] Emit Arize traces for each Claude call — verify spans appear in Phoenix UI

### Integration (stage two)
- [ ] Swap pipeline stubs for real agent calls and run full end-to-end: intake → scheduling → invoicing
- [ ] Confirm work-order object in Redis is correct after each stage
- [ ] Run demo script: seeded request in, approved invoice + vendor email out
