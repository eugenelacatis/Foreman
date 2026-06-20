"""Live end-to-end smoke test for the front of the lifecycle.

Runs the real intake + scheduling agents against the Anthropic API with a
seeded request and prints the enriched work-order sections. Requires
ANTHROPIC_API_KEY; skips gracefully if it is absent. Run with Phoenix up to
confirm spans appear in the Arize Phoenix UI.

Usage:  python -m backend.scripts.smoke_front
"""

import asyncio
import json
import os

from dotenv import load_dotenv

load_dotenv()

SEEDED_REQUEST = (
    "AC broken at 123 Main St, residential split system, R-410A, it's super hot "
    "and we need this fixed ASAP. Contact John Doe at 555-0123."
)


async def main() -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping live smoke run.")
        return

    from backend.agents.intake_agent import run_intake
    from backend.agents.scheduling_agent import run_scheduling

    work_order = {"raw_request": SEEDED_REQUEST}

    classification = await run_intake(work_order)
    work_order["classification"] = classification
    print("=== CLASSIFICATION ===")
    print(json.dumps(classification, indent=2))

    schedule = await run_scheduling(work_order)
    print("\n=== SCHEDULE ===")
    print(json.dumps(schedule, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
