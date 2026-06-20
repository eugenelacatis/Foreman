"""Tests for the intake agent (Harshita's task list — intake items)."""

from unittest.mock import AsyncMock

from backend.agents import intake_agent
from tests.conftest import FakeResponse, FakeText, FakeToolUse


async def test_classify_job_maps_fields(monkeypatch):
    """A populated classify_job tool call flows through to the result dict."""
    tool = FakeToolUse(
        "classify_job",
        {
            "job_type": "HVAC",
            "entities": {"location": "123 Main St", "contact_name": "John"},
            "completeness_flags": ["UNCLEAR_URGENCY"],
        },
    )
    monkeypatch.setattr(
        intake_agent.client.messages,
        "create",
        AsyncMock(return_value=FakeResponse([tool])),
    )

    result = await intake_agent.run_intake({"raw_request": "AC broken at 123 Main St"})

    assert result["job_type"] == "HVAC"
    assert result["entities"]["location"] == "123 Main St"
    assert result["completeness_flags"] == ["UNCLEAR_URGENCY"]


async def test_fallback_on_exception(monkeypatch):
    """If the Anthropic call raises, we return the stub with a FALLBACK flag."""
    monkeypatch.setattr(
        intake_agent.client.messages,
        "create",
        AsyncMock(side_effect=RuntimeError("API down")),
    )

    result = await intake_agent.run_intake({"raw_request": "anything"})

    assert result["job_type"] == "UNKNOWN"
    assert result["completeness_flags"] == ["FALLBACK"]


async def test_no_tool_use_returns_stub(monkeypatch):
    """A plain-text response (no tool_use block) falls back to the stub."""
    monkeypatch.setattr(
        intake_agent.client.messages,
        "create",
        AsyncMock(return_value=FakeResponse([FakeText("sorry")], stop_reason="end_turn")),
    )

    result = await intake_agent.run_intake({"raw_request": "anything"})

    assert result["completeness_flags"] == ["FALLBACK"]
