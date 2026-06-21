"""Tests for the scheduling agent (Harshita's task list — scheduling items)."""

from unittest.mock import AsyncMock

from backend.agents import scheduling_agent
from tests.conftest import FakeResponse, FakeToolUse


def test_seeded_prices_override_guess():
    """A part matching a seeded name gets the seeded price, not Claude's guess."""
    parts = [
        {"name": "Air Filter (16x25x1)", "reason": "ESTIMATED PRICE - routine swap",
         "estimated_price_usd": 99.0},
        {"name": "mystery widget", "reason": "ESTIMATED PRICE - unknown",
         "estimated_price_usd": 3.5},
    ]
    result = scheduling_agent._apply_seeded_prices(parts)

    assert result[0]["estimated_price_usd"] == 12.99  # overridden from seed
    assert result[1]["estimated_price_usd"] == 3.5     # unknown part keeps its guess


def test_estimated_price_label_default():
    """Parts missing a reason still get the ESTIMATED PRICE - prefix."""
    result = scheduling_agent._apply_seeded_prices([{"name": "thingamajig"}])
    assert result[0]["reason"].startswith("ESTIMATED PRICE - ")


async def test_three_tools_in_one_loop(monkeypatch):
    """All three tools called in a single turn populate all three sections."""
    content = [
        FakeToolUse("propose_times",
                    {"times": ["2026-06-21T09:00:00"], "reasoning": "urgent"}, id="t1"),
        FakeToolUse("draft_outreach",
                    {"message": "We can come Saturday 9am.", "channel": "sms"}, id="t2"),
        FakeToolUse("suggest_parts",
                    {"parts": [{"name": "air filter", "reason": "ESTIMATED PRICE - swap",
                                "estimated_price_usd": 50.0}]}, id="t3"),
    ]
    # First call returns all three tool_use blocks; second call ends the turn.
    responses = [
        FakeResponse(content, stop_reason="tool_use"),
        FakeResponse([], stop_reason="end_turn"),
    ]
    monkeypatch.setattr(
        scheduling_agent.client.messages,
        "create",
        AsyncMock(side_effect=responses),
    )

    result = await scheduling_agent.run_scheduling(
        {"classification": {"job_type": "HVAC", "entities": {}, "completeness_flags": []}}
    )

    assert result["proposed_times"] == ["2026-06-21T09:00:00"]
    assert result["outreach_draft"] == {"message": "We can come Saturday 9am.", "channel": "sms"}
    assert len(result["parts_suggestion"]) == 1
    assert result["parts_suggestion"][0]["estimated_price_usd"] == 12.99  # seeded override
    assert result["parts_suggestion"][0]["reason"].startswith("ESTIMATED PRICE - ")


async def test_fallback_on_exception(monkeypatch):
    """If the loop raises, return the stub schedule."""
    monkeypatch.setattr(
        scheduling_agent.client.messages,
        "create",
        AsyncMock(side_effect=RuntimeError("API down")),
    )

    result = await scheduling_agent.run_scheduling({"classification": {}})

    assert result == scheduling_agent._STUB_SCHEDULE
    assert result["outreach_draft"]["message"] == "FALLBACK"
