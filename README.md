# Foreman

Multi-agent field service invoicing. A work order flows through three AI agents (intake, scheduling, invoicing) with a human approving every step that actually commits anything.

## How it works

```
Raw request → Intake → Scheduling → Invoicing → Approved invoice + vendor email
```

Each agent reads the shared work-order object in Redis, writes its own section, and stops at a human approval gate before the next stage runs. Agents don't call each other; they pass state through the object.

The invoicing stage is a multi-turn conversation. The agent prefills what it can from the work order, asks only for what's missing (labor rate, hours, trip charge), checks the draft against past invoices for rate consistency, then produces a branded invoice and vendor email draft. Nothing commits without human sign-off.

## Quick start

You need Python 3.11, Redis, and an Anthropic API key.

```bash
cp backend/.env.example backend/.env
# fill in ANTHROPIC_API_KEY in backend/.env

make dev    # starts Redis + Phoenix + uvicorn on :8001
make test   # runs the smoke test suite (no API key needed)
```

## API

| Endpoint | What it does |
|---|---|
| `POST /work-orders` | Create a work order from a raw request |
| `GET /work-orders/{id}` | Fetch current state |
| `POST /work-orders/{id}/approve` | Approve a stage (triggers the next agent) |
| `POST /work-orders/{id}/invoice-chat` | Send a message to the invoicing agent |
| `GET /work-orders/{id}/invoice-history` | Pull past invoices for the consistency check |

## Integrations

- **Anthropic** — all three agents use Claude with tool use
- **Arize Phoenix** — every Claude call is traced; spans link back to the work order via `trace_id`, visible at `http://localhost:6006`
- **ArmorIQ** — committing actions are signed and checked at runtime; `DEMO_BLOCK` triggers a visible operator alert
- **Redis** — work-order state and invoice history

## Environment variables

```
ANTHROPIC_API_KEY=
REDIS_URL=redis://localhost:6379
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
ARMORIQ_API_KEY=          # optional; stub works without it for demo
ARIZE_SPACE_ID=           # optional; local Phoenix works without it
ARIZE_API_KEY=            # optional; local Phoenix works without it
```

## Team

Eugene (invoicing agent + API spine), Bhoomika (orchestration + Redis), Harshita (intake + scheduling), Michelle (UI + demo)
