"""
Test gap-fill loop end-to-end with a seeded work order.

No ANTHROPIC_API_KEY required — Claude responses are mocked.

Run:
    python -m backend.scripts.test_gap_fill
"""

from __future__ import annotations

import asyncio
import json
import sys
import types
import unittest.mock as mock

from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

SEEDED_WORK_ORDER = {
    "id": "wo-test-001",
    "status": "invoicing",
    "raw_request": "HVAC unit not cooling at 123 Main St. Arctic Air HVAC on site.",
    "classification": {
        "job_type": "HVAC",
        "entities": {"vendor": "Arctic Air HVAC", "location": "123 Main St"},
        "completeness_flags": {
            "has_vendor": True,
            "has_location": True,
            "has_job_type": True,
        },
    },
    "schedule": {
        "proposed_times": ["2026-06-21 09:00", "2026-06-22 13:00"],
        "outreach_draft": "We have you scheduled for an HVAC diagnostic.",
        "parts_suggestion": [
            {"part": "R-410A refrigerant", "qty": 2, "estimated_price": 85.00},
            {"part": "Capacitor", "qty": 1, "estimated_price": 45.00},
        ],
    },
    "invoice": None,
    "approvals": {
        "intake_approved": True,
        "scheduling_approved": True,
        "invoice_approved": False,
    },
    "trace_id": None,
}


def _make_prefill_message() -> Message:
    return Message(
        id="msg_prefill",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_prefill",
                type="tool_use",
                name="prefill_invoice",
                input={
                    "line_items": [
                        {
                            "description": "R-410A refrigerant (2 lbs)",
                            "qty": 2,
                            "unit_price": 85.00,
                            "total": 170.00,
                        },
                        {
                            "description": "Capacitor replacement",
                            "qty": 1,
                            "unit_price": 45.00,
                            "total": 45.00,
                        },
                    ],
                    "rates": {},
                    "notes": "HVAC diagnostic and repair at 123 Main St.",
                },
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=100, output_tokens=80),
    )


def _make_flag_missing_message() -> Message:
    return Message(
        id="msg_flag",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_flag",
                type="tool_use",
                name="flag_missing_fields",
                input={"fields": ["labor_rate", "trip_charge", "technician_hours"]},
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=120, output_tokens=40),
    )


def _make_question_message() -> Message:
    return Message(
        id="msg_question",
        type="message",
        role="assistant",
        content=[
            TextBlock(
                type="text",
                text=(
                    "To complete this invoice I need a few details: "
                    "What is the labor rate per hour? Is there a trip charge? "
                    "How many hours did the technician work?"
                ),
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=130, output_tokens=50),
    )


def _make_check_consistency_message() -> Message:
    return Message(
        id="msg_check",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_check",
                type="tool_use",
                name="check_consistency",
                input={
                    "invoice_draft": {
                        "line_items": [
                            {
                                "description": "R-410A refrigerant",
                                "qty": 2,
                                "unit_price": 85.00,
                                "total": 170.00,
                            },
                            {
                                "description": "Labor (2.5 hrs)",
                                "qty": 2.5,
                                "unit_price": 95.00,
                                "total": 237.50,
                            },
                        ],
                        "rates": {"labor_per_hour": 95.00, "trip_charge": 65.00},
                    },
                    "history_results": [],
                },
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=150, output_tokens=90),
    )


def _make_fill_template_message(invoice_data: dict) -> Message:
    return Message(
        id="msg_fill",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_fill",
                type="tool_use",
                name="fill_template",
                input={"invoice_data": invoice_data},
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=200, output_tokens=60),
    )


def _make_draft_email_message() -> Message:
    return Message(
        id="msg_email",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_email",
                type="tool_use",
                name="draft_vendor_email",
                input={
                    "vendor_name": "Arctic Air HVAC",
                    "invoice_summary": "HVAC repair at 123 Main St. Total: $537.50.",
                },
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=180, output_tokens=55),
    )


def _make_done_message() -> Message:
    return Message(
        id="msg_done",
        type="message",
        role="assistant",
        content=[
            TextBlock(type="text", text="Invoice complete and vendor email drafted.")
        ],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=50, output_tokens=20),
    )


async def test_gap_fill_asks_questions() -> None:
    """First call with no user_message: agent should prefill then flag missing fields."""
    from backend.agents.invoicing_agent import run_invoicing

    # Pass 1: prefill → flag_missing → question
    responses = iter(
        [
            _make_prefill_message(),
            _make_flag_missing_message(),
            _make_question_message(),
        ]
    )

    async def fake_create(**kwargs):
        return next(responses)

    with mock.patch("backend.agents.invoicing_agent.client") as mock_client:
        mock_client.messages.create = fake_create
        result = await run_invoicing(SEEDED_WORK_ORDER, user_message=None)

    assert result["status"] == "PENDING_USER_INPUT", (
        f"Expected PENDING_USER_INPUT, got {result['status']}"
    )
    assert "missing_fields" in result, "missing_fields key absent"
    assert "labor_rate" in result["missing_fields"], (
        f"Expected labor_rate in missing_fields, got {result['missing_fields']}"
    )
    print(
        "[PASS] gap-fill first call: status=PENDING_USER_INPUT, missing_fields include labor_rate"
    )
    print(f"       question_for_user: {result.get('question_for_user', '(none)')}")


async def test_gap_fill_completes_with_clarification() -> None:
    """Second call with user_message: agent should complete and fill template."""
    from backend.agents.invoicing_agent import run_invoicing

    invoice_data_for_template = {
        "vendor_name": "Arctic Air HVAC",
        "job_type": "HVAC",
        "line_items": [
            {
                "description": "R-410A refrigerant (2 lbs)",
                "qty": 2,
                "unit_price": 85.00,
                "total": 170.00,
            },
            {
                "description": "Capacitor replacement",
                "qty": 1,
                "unit_price": 45.00,
                "total": 45.00,
            },
            {
                "description": "Labor — diagnostic + repair (2.5 hrs)",
                "qty": 2.5,
                "unit_price": 95.00,
                "total": 237.50,
            },
        ],
        "rates": {"labor_per_hour": 95.00, "trip_charge": 65.00},
        "notes": "HVAC diagnostic and repair at 123 Main St.",
    }

    responses = iter(
        [
            _make_check_consistency_message(),
            _make_fill_template_message(invoice_data_for_template),
            _make_draft_email_message(),
            _make_done_message(),
        ]
    )

    async def fake_create(**kwargs):
        return next(responses)

    with mock.patch("backend.agents.invoicing_agent.client") as mock_client:
        mock_client.messages.create = fake_create
        result = await run_invoicing(
            SEEDED_WORK_ORDER,
            user_message="Labor rate is $95/hr, trip charge $65, technician worked 2.5 hrs",
        )

    assert result["status"] == "COMPLETE", f"Expected COMPLETE, got {result['status']}"
    invoice = result.get("invoice", {})
    assert invoice.get("template_filled"), "template_filled is empty"
    assert invoice.get("vendor_email_draft"), "vendor_email_draft is empty"
    print(
        "[PASS] gap-fill second call: status=COMPLETE, template_filled and vendor_email_draft present"
    )
    print(f"       invoice_id: {invoice.get('invoice_id')}")
    print(f"       template snippet: {str(invoice.get('template_filled', ''))[:80]}...")


async def main() -> None:
    print("=== gap-fill test: round 1 (no user_message) ===")
    await test_gap_fill_asks_questions()
    print()
    print("=== gap-fill test: round 2 (with clarification) ===")
    await test_gap_fill_completes_with_clarification()
    print()
    print("All gap-fill tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
