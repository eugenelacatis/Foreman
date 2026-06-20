"""
Test ArmorIQ DEMO_BLOCK — confirm the block fires at each level.

No API keys required.

Run:
    python3.11 -m backend.scripts.test_armoriq
"""

from __future__ import annotations

import asyncio
import unittest.mock as mock

from anthropic.types import Message, TextBlock, ToolUseBlock, Usage


# --- level 1: check_action stub returns False for DEMO_BLOCK ---


async def test_check_action_blocks_demo() -> None:
    from backend.agents.armoriq_client import check_action

    result = await check_action(action="DEMO_BLOCK", plan_id="test-plan-123")
    assert result is False, f"Expected False, got {result}"
    print("[PASS] check_action('DEMO_BLOCK') returns False")


async def test_check_action_allows_normal() -> None:
    from backend.agents.armoriq_client import check_action

    result = await check_action(action="fill_template", plan_id="test-plan-456")
    assert result is True, f"Expected True for normal action, got {result}"
    print("[PASS] check_action('fill_template') returns True")


# --- level 2: _dispatch_tool raises ArmorIQBlockedError when check_action returns False ---


async def test_dispatch_raises_when_blocked() -> None:
    from backend.agents.armoriq_client import ArmorIQBlockedError
    from backend.agents.invoicing_agent import _dispatch_tool

    async def always_false(action, plan_id, api_key=None):
        return False

    with mock.patch(
        "backend.agents.invoicing_agent.check_action", side_effect=always_false
    ):
        try:
            await _dispatch_tool(
                "fill_template",
                {
                    "invoice_data": {
                        "vendor_name": "TestCo",
                        "job_type": "HVAC",
                        "line_items": [],
                        "rates": {},
                        "notes": "",
                    }
                },
                {},
            )
            assert False, "Expected ArmorIQBlockedError but none raised"
        except ArmorIQBlockedError as exc:
            print(f"[PASS] _dispatch_tool raised ArmorIQBlockedError: {exc}")


# --- level 3: run_invoicing surfaces the block in its result ---


def _make_fill_template_msg() -> Message:
    return Message(
        id="msg_fill",
        type="message",
        role="assistant",
        content=[
            ToolUseBlock(
                id="tu_fill",
                type="tool_use",
                name="fill_template",
                input={
                    "invoice_data": {
                        "vendor_name": "Arctic Air HVAC",
                        "job_type": "HVAC",
                        "line_items": [
                            {
                                "description": "Labor",
                                "qty": 2,
                                "unit_price": 95.0,
                                "total": 190.0,
                            }
                        ],
                        "rates": {"labor_per_hour": 95.0, "trip_charge": 65.0},
                        "notes": "Test invoice",
                    }
                },
            )
        ],
        model="claude-sonnet-4-6",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=Usage(input_tokens=100, output_tokens=60),
    )


def _make_done_msg() -> Message:
    return Message(
        id="msg_done",
        type="message",
        role="assistant",
        content=[TextBlock(type="text", text="Invoice complete.")],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=30, output_tokens=10),
    )


SEEDED_WORK_ORDER = {
    "id": "wo-armoriq-test",
    "status": "invoicing",
    "raw_request": "HVAC repair at 123 Main St.",
    "classification": {
        "job_type": "HVAC",
        "entities": {"vendor": "Arctic Air HVAC"},
        "completeness_flags": {},
    },
    "schedule": {
        "proposed_times": [],
        "outreach_draft": "",
        "parts_suggestion": [],
    },
    "invoice": None,
    "approvals": {
        "intake_approved": True,
        "scheduling_approved": True,
        "invoice_approved": False,
    },
    "trace_id": None,
}


async def test_run_invoicing_blocked_response() -> None:
    from backend.agents.invoicing_agent import run_invoicing

    responses = iter([_make_fill_template_msg(), _make_done_msg()])

    async def fake_create(**kwargs):
        return next(responses)

    async def always_false(action, plan_id, api_key=None):
        return False

    with (
        mock.patch("backend.agents.invoicing_agent.client") as mock_client,
        mock.patch(
            "backend.agents.invoicing_agent.check_action", side_effect=always_false
        ),
    ):
        mock_client.messages.create = fake_create
        result = await run_invoicing(
            SEEDED_WORK_ORDER,
            user_message="Labor $95/hr, 2 hrs, trip charge $65",
        )

    # When ArmorIQ blocks, the loop breaks without setting template_filled
    invoice = result.get("invoice", {})
    assert not invoice.get("template_filled"), (
        f"template_filled should be absent when blocked, got: {invoice.get('template_filled')}"
    )
    print(
        "[PASS] run_invoicing: template_filled absent when ArmorIQ blocks fill_template"
    )
    print(f"       result status: {result.get('status')}")


async def main() -> None:
    print("=== ArmorIQ block tests ===")
    await test_check_action_blocks_demo()
    await test_check_action_allows_normal()
    await test_dispatch_raises_when_blocked()
    await test_run_invoicing_blocked_response()
    print()
    print("All ArmorIQ tests passed.")


if __name__ == "__main__":
    asyncio.run(main())
