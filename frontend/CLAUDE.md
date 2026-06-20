# CLAUDE.michelle.md (Designer: interface and demo)

Read `CLAUDE.md` (root) first. This file fences your role. You own the entire interface and the demo video. This is the most important visible job on the team, because the UI and the demo are all the judges actually see and score.

## You own

### 1. The interface (Vite + React + Tailwind + shadcn/ui)
A dashboard that shows a work order moving through its three stages, with the agents visibly working and the human approving.

The screens that matter:
- The work order arriving and intake classifying it.
- Scheduling proposing times, the outreach draft, and the labeled parts suggestion.
- Invoicing: the side-by-side of work order to filled invoice, the gap-fill conversation, the consistency check, and the branded invoice draft.
- The human-approval moments. These should feel like deliberate, satisfying confirmations, because the approval gate is the whole thesis.
- The ArmorIQ block firing when an agent tries an off-plan action. This is a demo highlight. Make it legible and a little dramatic.
- The Arize traces, surfaced enough that a judge can see the agent's reasoning is real.

### 2. The demo video
The recorded fallback in case anything breaks live. Own the two-minute cut: open on the manual invoice pain, then ForemanAI doing it cleanly, ending on the approval gate and the time saved.

## You must NOT
- Build agent logic or backend. You consume the API the spine exposes.
- Wait for the backend to be finished before starting. Build against the OpenAPI contract and mock data from day one.

## Guardrails for your Claude Code session
- Use shadcn/ui components so you spend time on the demo flow and the polish, not on building primitives.
- Build against the OpenAPI spec and seeded data immediately. Do not block on the real agents being ready. Swap mock data for live calls late.
- The two lean stages (intake, scheduling) must look as finished as invoicing. Coordinate with Person A so the front of the lifecycle does not look like a placeholder next to the deep invoicing screen.
- This file sets up what to build. The actual interface design and interaction polish are yours. Make it feel like a real product, not a hackathon shell.

## Done looks like
A judge can watch a work order flow through all three stages, see the agents reason, approve at each gate, watch the ArmorIQ block fire, and read the time saved, all in a polished UI, with a recorded video ready if the live demo stumbles.
