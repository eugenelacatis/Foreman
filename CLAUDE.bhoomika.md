# CLAUDE.bhoomika.md (spine and integration lead)

Read `CLAUDE.md` (root) first. This file fences your role. You own the spine: the orchestration, the shared state, the Redis layer, and final integration. This is the seat that makes the other three agents actually work together. It is harder than owning one agent, not lighter.

## You own

### 1. The work-order state layer (Redis)
- The Redis storage for the work-order object that every agent reads and writes.
- The invoice-history index: a vector search over past invoices so the invoicing agent can check consistency. Eugene depends on this, so expose a clean interface for it early, even if it starts with seeded history.

### 2. Orchestration (the spine)
- The async Python coordination that advances a work order through intake, scheduling, invoicing.
- The human-approval gates between stages. These pause the pipeline for confirmation. The gate is the thesis, build it as a real stop, not a cosmetic one.
- Lock the work-order schema with Eugene in the first 90 minutes. This is priority zero.

### 3. ArmorIQ integration
- Wrap agent actions so each agent's plan is signed and off-plan actions are blocked at runtime.
- Make sure the block is demoable, especially on the invoicing commit step.

### 4. Integration lead (stage two)
- As the other agents finish, you wire them together against the contract.
- Person A joins you first. Eugene joins once invoicing is solid.

### 5. Optional: Orkes Conductor (bounty)
- If the core spine is running by hour 4, wrap the approval step as a Conductor workflow for the Orkes bounty.
- Hour-4 checkpoint: if Orkes is fighting you, drop it to the single approval workflow or cut it. Losing Orkes loses a bounty, not the project. Do not let it block the core spine.

## You must NOT
- Build agent reasoning logic. Intake and scheduling are Person A, invoicing is Eugene. You build the layer they run on.
- Build the UI.
- Treat Orkes as the foundation. Your own async coordination is the spine. Orkes rides on top.
- Build procurement, live send, or payments.

## Guardrails for your Claude Code session
- The orchestration design and the vector-search setup are yours to reason through. This file frames the problem, it does not solve it.
- Expose interfaces early and stub them with seeded data so the agent owners are never blocked waiting on you. This is the most important thing you do in stage one.
- Build against the OpenAPI contract. Keep it current so the others build against truth.

## If both backend people lean model over infra
If you and Person A both turn out stronger at model and prompt work than at infrastructure, the plan changes: you and Eugene pair on the spine for the first few hours to stand up Redis and orchestration together, then split. Flag this at the kickoff so we adjust before anyone is stuck.

## Done looks like
The work-order object lives in Redis, agents read and write it through clean interfaces, the pipeline advances through real approval gates, ArmorIQ blocks an off-plan action on cue, and (if time) the approval step runs as an Orkes workflow.

## Task list

### Schema + state layer (do first, blocks everyone)
- [x] Lock work-order schema with Eugene (`backend/models/work_order.py`)
- [x] Async Redis client: `get_work_order`, `save_work_order`, `init_redis`, `close_redis` (`backend/state/redis_client.py`)
- [x] Seeded invoice history + keyword search (`backend/state/invoice_history.py`)
- [x] Stand up Redis locally and confirm `init_redis` ping succeeds on startup — Redis Stack 7.4 running on port 6379
- [x] Confirm `get_work_order` / `save_work_order` round-trip a `WorkOrder` correctly — verified via demo_flow.py
- [x] Replace keyword search in `search_invoice_history` with Redis vector search (RediSearch / VSS) — done, sentence-transformers HNSW index, 15 seeded invoices, keyword fallback if Stack unavailable

### Orchestration spine
- [x] `advance_pipeline` gate logic wired to agent stubs (`backend/orchestration/pipeline.py`)
- [x] Confirm gate logic is a real stop: pipeline must not advance past intake without `intake_approved = True`
- [x] Hook `advance_pipeline` into the approve endpoint so approving a stage automatically triggers the next agent
- [x] Test full gate sequence: create → approve intake → approve scheduling → approve invoice → status = complete

### ArmorIQ integration
- [x] `sign_plan` / `check_action` stubs with TODO HTTP calls (`backend/agents/armoriq_client.py`)
- [ ] Wire real ArmorIQ HTTP calls when API key is available (replace the TODO stubs)
- [ ] Confirm `DEMO_BLOCK` path fires correctly and the frontend overlay triggers — pending Michelle's UI

### Optional: Orkes Conductor (only if core is solid by hour 4)
- [ ] Wrap the human-approval gate as a Conductor workflow
- [ ] Confirm the Orkes workflow pauses for human input and resumes on approval
- [ ] Hour-4 checkpoint: if Orkes is fighting you, cut it

### Integration lead (stage two)
- [x] Wire Harshita's agents into pipeline once she signals ready
- [x] Wire Eugene's invoicing agent into pipeline once he signals ready
- [x] Run full end-to-end: seeded request → intake → scheduling → invoicing → approved invoice in Redis

### Remaining tasks
- [ ] Update `Makefile`: replace `brew services start redis` with `redis-stack-server --port 6379 --daemonize yes` — plain Redis lacks FT.SEARCH and will silently break vector search for any teammate running `make dev`
