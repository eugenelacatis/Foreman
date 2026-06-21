# CLAUDE.md (root)

This file is shared context for every role on ForemanAI. Each teammate also has a role file (`CLAUDE.eugene.md`, `CLAUDE.persona.md`, etc.) that they point their Claude Code session at. Read this first, then your role file.

## What ForemanAI is

A multi-agent system that moves a work order through its lifecycle: intake, scheduling, invoicing. A human approves every step that commits anything. Invoicing is the deepest stage. We are building this at a 24-hour hackathon to win sponsor bounties and a main-track placement.

We are NOT building: procurement as a full agent, live email send, real payments, or the rest of the lifecycle. Those are roadmap. Do not build them.

## Core principle: the work order is the shared object

Agents do not call each other directly. Each agent reads and writes a single shared work-order object in Redis. The pipeline advances by one agent enriching the object and the next agent reading it. This is what lets four people build in parallel without importing each other's code.

If you find yourself wanting to import another agent's module, stop. Talk to the work-order object instead.

## Stack

- Backend: Python, FastAPI, async.
- Agents: Anthropic SDK directly, using tool use. No heavy agent framework. Frameworks add abstraction we do not have time to fight.
- State: Redis. Holds the work-order object and the invoice-history vector index.
- API contract: FastAPI generates an OpenAPI spec. That spec is the shared interface. Build against it, not against assumptions.
- Frontend: Vite + React + Tailwind + shadcn/ui.
- Orchestration: our own async Python coordination is the spine. Orkes Agentspan is an OPTIONAL bounty integration layered on top, not the foundation. See "Sponsor integrations."
- Safety: ArmorIQ wraps agent actions and enforces the approved plan.
- Observability: Arize Phoenix traces agent decisions.
- Parts pricing: Browserbase, behind the parts-suggestion feature only.

## The work-order object (shared schema, lock this first)

This schema is owned by Eugene and the spine owner and frozen in the first 90 minutes. Do not change fields without telling everyone. A first cut to argue over:

- `id`
- `status`: which stage the order is in
- `raw_request`: the original unstructured request (intake reads this)
- `classification`: what intake produced (job type, completeness flags)
- `schedule`: proposed times, outreach draft, parts suggestion (scheduling produces this)
- `invoice`: line items, rates, the filled template, draft email (invoicing produces this)
- `approvals`: which human gates have been passed
- `trace_id`: links to the Arize trace

Each agent owns its own section and reads the sections before it. Nobody writes another agent's section.

## Human-in-the-loop is the thesis, not a feature

Every commit point pauses for human approval. The agent proposes, a person confirms. The demo highlight is showing an ArmorIQ check block an off-plan action. Do not build any path that commits without a human. If you are tempted to auto-approve "to make the demo smoother," don't. The approval gate IS the demo.

## Path B: what is real, what is faked

The architecture and agent reasoning are real. External edges that need the outside world (any send, live pricing calls) run on seeded data for the demo, with a recorded video as the ultimate fallback. We have a hotspot, so the network is not the worry, but we still record the fallback. Build features so they degrade gracefully to seeded data when an external call fails. A failed external call must never break the demo.

## Sponsor integrations (priority order)

Load-bearing, build these into the core:
- Anthropic (the agents) — frame demo pitch around economic opportunity for field service workers and SMB trades; aspiration + effort count as much as polish
- Redis (shared state + invoice-history search)
- ArmorIQ (action safety, the approval gate)
- Arize Phoenix (tracing) — label spans meaningfully (gap-fill decisions, consistency check, ArmorIQ checks); judges want evidence it improved the app, not just that it exists

Optional bolt-ons, only if the core is solid. One person, time permitting, no one builds the system around these:
- Orkes Agentspan: wrap the approval step as an Agentspan workflow for the bounty.
- Browserbase: live local pricing behind the parts suggestion, falls back to seeded prices.
- Fetch.ai: register one agent as a uAgent on Agentverse for the bounty. Do NOT rearchitect around the agent-marketplace model. It is a logo, not a foundation.
- Sentry: error and crash monitoring on top of Arize Phoenix (which handles LLM tracing). ~15 min to wire up. Add the Python SDK to FastAPI and the JS SDK to the Vite frontend. Tag every captured event with `work_order_id` and `status` so any error links back to the exact order and pipeline stage. Do not touch the agent reasoning or approval flow to add this — it wraps the outside, not the inside.

## Working rules for four parallel Claude Code sessions

- Build against the work-order schema and the OpenAPI spec, never against another person's code.
- Your role file fences what you own and what you must not touch. Stay in your lane.
- Do not solve another role's problem in your session. If something you need is missing from the contract, raise it, do not work around it silently.
- Commit small and often. Assume someone else is touching the repo right now.
- These files set up the problem. They do not contain solved implementations. Reason through the actual building in your session.

## Two-stage plan

Stage one: everyone builds their piece in parallel against the locked contract.
Stage two: integration. Person A finishes first by design and joins the spine owner to wire agents together. Eugene stays on invoicing to avoid bottlenecking, then joins integration.

## Hour-4 checkpoint (decide, do not drift)

If Orkes Agentspan is not running cleanly by hour 4, drop it to just the single approval workflow or cut it entirely. Losing Orkes loses one bounty, not the project. Do not let any optional sponsor integration block the core.
