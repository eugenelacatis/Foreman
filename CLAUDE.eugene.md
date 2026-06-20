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
