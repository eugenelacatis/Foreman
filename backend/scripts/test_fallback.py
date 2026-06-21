"""
Test graceful fallback for the front-of-lifecycle agents.

When the Anthropic call fails, intake and scheduling must degrade to seeded
stubs marked FALLBACK instead of crashing — a failed external call must never
break the demo.

No ANTHROPIC_API_KEY required — the Claude client is mocked to raise.

Run:
    python -m backend.scripts.test_fallback
"""

from __future__ import annotations

import asyncio
import unittest.mock as mock

SEEDED_REQUEST = {
    "raw_request": "AC broken at 123 Main St, residential split system, ASAP. John Doe 555-0123.",
    "classification": {
        "job_type": "HVAC",
        "entities": {"location": "123 Main St"},
        "completeness_flags": [],
    },
}


async def _failing_create(**kwargs):
    raise RuntimeError("simulated Anthropic outage")


async def test_intake_fallback() -> None:
    """Intake returns the stub with a FALLBACK flag when Claude is unreachable."""
    from backend.agents import intake_agent

    with mock.patch.object(intake_agent, "client") as mock_client:
        mock_client.messages.create = _failing_create
        result = await intake_agent.run_intake(SEEDED_REQUEST)

    assert result["job_type"] == "UNKNOWN", f"Expected UNKNOWN, got {result['job_type']}"
    assert "FALLBACK" in result["completeness_flags"], (
        f"Expected FALLBACK flag, got {result['completeness_flags']}"
    )
    print("[PASS] intake fallback: job_type=UNKNOWN, completeness_flags include FALLBACK")


async def test_scheduling_fallback() -> None:
    """Scheduling returns the stub schedule marked FALLBACK when Claude is unreachable."""
    from backend.agents import scheduling_agent

    with mock.patch.object(scheduling_agent, "client") as mock_client:
        mock_client.messages.create = _failing_create
        result = await scheduling_agent.run_scheduling(SEEDED_REQUEST)

    assert result["outreach_draft"]["message"] == "FALLBACK", (
        f"Expected FALLBACK outreach, got {result['outreach_draft']}"
    )
    print("[PASS] scheduling fallback: outreach_draft.message == FALLBACK")


async def main() -> None:
    print("=== fallback test: intake ===")
    await test_intake_fallback()
    print()
    print("=== fallback test: scheduling ===")
    await test_scheduling_fallback()
    print()
    print("All fallback tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
