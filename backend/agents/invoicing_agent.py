import json
import logging
import os
import uuid
from datetime import date

import anthropic
from openinference.instrumentation.anthropic import AnthropicInstrumentor
from phoenix.otel import register

from .armoriq_client import ArmorIQBlockedError, check_action, sign_plan
from .invoice_template import render_template
from ..seeds.invoice_history import INVOICE_HISTORY

logger = logging.getLogger(__name__)

tracer_provider = register(
    project_name="foreman-ai",
    endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces"),
)
AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "prefill_invoice",
        "description": (
            "Create an initial invoice draft from what is already known about the job. "
            "Call this first to populate any fields derivable from classification and schedule."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "line_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "qty": {"type": "number"},
                            "unit_price": {"type": "number"},
                            "total": {"type": "number"},
                        },
                        "required": ["description", "qty", "unit_price", "total"],
                    },
                    "description": "Line items derivable from the schedule parts suggestion.",
                },
                "rates": {
                    "type": "object",
                    "description": "Known rates, e.g. {labor_per_hour, trip_charge}.",
                },
                "notes": {
                    "type": "string",
                    "description": "Any notes to carry forward from the work order.",
                },
            },
            "required": ["line_items", "rates", "notes"],
        },
    },
    {
        "name": "flag_missing_fields",
        "description": (
            "Identify invoice fields that are still unknown and must be provided by the user "
            "before the invoice can be finalized."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "fields": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "List of missing field names, e.g. ['labor_rate', 'trip_charge', 'technician_hours']."
                    ),
                }
            },
            "required": ["fields"],
        },
    },
    {
        "name": "check_consistency",
        "description": (
            "Compare the current invoice draft against past invoice history. "
            "Returns flags if rates or totals look anomalous."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_draft": {
                    "type": "object",
                    "description": "The current invoice draft dict.",
                },
                "history_results": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Past invoices retrieved from the vector store (or seeded fallback).",
                },
            },
            "required": ["invoice_draft", "history_results"],
        },
    },
    {
        "name": "fill_template",
        "description": "Render the branded ForemanAI invoice template from the finalized invoice data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {
                    "type": "object",
                    "description": "Finalized invoice dict with line_items, rates, vendor_name, job_type, notes.",
                }
            },
            "required": ["invoice_data"],
        },
    },
    {
        "name": "draft_vendor_email",
        "description": "Draft the vendor notification email summarising the approved invoice.",
        "input_schema": {
            "type": "object",
            "properties": {
                "vendor_name": {"type": "string"},
                "invoice_summary": {
                    "type": "string",
                    "description": "A short prose summary of what was invoiced and the total.",
                },
            },
            "required": ["vendor_name", "invoice_summary"],
        },
    },
]

SYSTEM_PROMPT = (
    "You are the invoicing agent for ForemanAI. "
    "You receive an enriched work order (with classification and schedule already filled) "
    "and must produce a complete, accurate invoice. "
    "Work in this order:\n"
    "1. Call prefill_invoice with whatever you can derive from the work order.\n"
    "2. Call flag_missing_fields for anything you cannot determine without the user.\n"
    "3. If user_message is provided, incorporate it and call check_consistency against history.\n"
    "4. Once all fields are resolved, call fill_template then draft_vendor_email.\n"
    "Never skip the human approval gate — fill_template and draft_vendor_email are "
    "guarded by ArmorIQ and will not run without a valid plan. "
    "Never respond in plain text alone — always call a tool."
)

_ARMORIQ_GUARDED = {"fill_template", "draft_vendor_email"}


def _tool_prefill_invoice(line_items: list[dict], rates: dict, notes: str) -> dict:
    return {
        "line_items": line_items,
        "rates": rates,
        "notes": notes,
        "invoice_id": f"INV-{uuid.uuid4().hex[:8].upper()}",
        "date": str(date.today()),
    }


def _tool_flag_missing_fields(fields: list[str]) -> dict:
    return {"missing_fields": fields, "status": "NEEDS_USER_INPUT"}


def _tool_check_consistency(invoice_draft: dict, history_results: list[dict]) -> dict:
    flags: list[str] = []
    draft_rates = invoice_draft.get("rates", {})
    draft_labor = draft_rates.get("labor_per_hour", 0.0)
    draft_trip = draft_rates.get("trip_charge", 0.0)

    labor_rates = [
        h.get("rates", {}).get("labor_per_hour", 0.0)
        for h in history_results
        if h.get("rates")
    ]
    trip_charges = [
        h.get("rates", {}).get("trip_charge", 0.0)
        for h in history_results
        if h.get("rates")
    ]

    if labor_rates and draft_labor > 0:
        avg_labor = sum(labor_rates) / len(labor_rates)
        if draft_labor > avg_labor * 1.3:
            flags.append(
                f"LABOR_RATE_HIGH: draft ${draft_labor}/hr vs avg ${avg_labor:.2f}/hr"
            )
        elif draft_labor < avg_labor * 0.7:
            flags.append(
                f"LABOR_RATE_LOW: draft ${draft_labor}/hr vs avg ${avg_labor:.2f}/hr"
            )

    if trip_charges and draft_trip > 0:
        avg_trip = sum(trip_charges) / len(trip_charges)
        if draft_trip > avg_trip * 1.5:
            flags.append(
                f"TRIP_CHARGE_HIGH: draft ${draft_trip} vs avg ${avg_trip:.2f}"
            )

    return {"consistency_flags": flags, "history_count": len(history_results)}


def _tool_fill_template(invoice_data: dict) -> str:
    return render_template(invoice_data)


def _tool_draft_vendor_email(vendor_name: str, invoice_summary: str) -> str:
    return (
        f"Subject: Invoice Ready for Review — ForemanAI\n\n"
        f"Dear {vendor_name},\n\n"
        f"Please find below a summary of the invoice prepared by ForemanAI "
        f"for the recent service:\n\n"
        f"{invoice_summary}\n\n"
        f"This invoice has been reviewed and approved by an authorised human. "
        f"Please confirm receipt and remit payment per your agreed terms.\n\n"
        f"Thank you,\nForemanAI Invoicing"
    )


async def _dispatch_tool(
    tool_name: str,
    tool_input: dict,
    invoice_state: dict,
) -> str:
    if tool_name in _ARMORIQ_GUARDED:
        plan_id = await sign_plan(action=tool_name, plan=tool_input)
        allowed = await check_action(action=tool_name, plan_id=plan_id)
        if not allowed:
            raise ArmorIQBlockedError(f"ArmorIQ blocked action: {tool_name}")

    if tool_name == "prefill_invoice":
        result = _tool_prefill_invoice(
            tool_input["line_items"], tool_input["rates"], tool_input["notes"]
        )
        invoice_state.update(result)
        return json.dumps(result)

    if tool_name == "flag_missing_fields":
        result = _tool_flag_missing_fields(tool_input["fields"])
        invoice_state["missing_fields"] = tool_input["fields"]
        return json.dumps(result)

    if tool_name == "check_consistency":
        result = _tool_check_consistency(
            tool_input["invoice_draft"], tool_input["history_results"]
        )
        invoice_state["consistency_flags"] = result["consistency_flags"]
        return json.dumps(result)

    if tool_name == "fill_template":
        rendered = _tool_fill_template(tool_input["invoice_data"])
        invoice_state["template_filled"] = rendered
        return rendered

    if tool_name == "draft_vendor_email":
        draft = _tool_draft_vendor_email(
            tool_input["vendor_name"], tool_input["invoice_summary"]
        )
        invoice_state["vendor_email_draft"] = draft
        return draft

    return json.dumps({"error": f"unknown tool: {tool_name}"})


def _get_history(work_order: dict) -> list[dict]:
    job_type = work_order.get("classification", {}).get("job_type", "")
    try:
        # TODO: replace with real Redis vector search when available
        raise NotImplementedError("vector search not wired yet")
    except Exception:
        if job_type:
            return [
                h
                for h in INVOICE_HISTORY
                if h.get("job_type", "").upper() == job_type.upper()
            ]
        return INVOICE_HISTORY[:3]


async def run_invoicing(work_order: dict, user_message: str | None = None) -> dict:
    history = _get_history(work_order)

    context_parts = [
        f"Work order ID: {work_order.get('id', 'UNKNOWN')}",
        f"Raw request: {work_order.get('raw_request', '')}",
        f"Classification: {json.dumps(work_order.get('classification', {}))}",
        f"Schedule: {json.dumps(work_order.get('schedule', {}))}",
        f"Invoice history ({len(history)} records): {json.dumps(history)}",
    ]
    if user_message:
        context_parts.append(f"User clarification: {user_message}")

    messages: list[anthropic.types.MessageParam] = [
        {"role": "user", "content": "\n\n".join(context_parts)}
    ]

    invoice_state: dict = {}
    question_for_user: str | None = None

    while True:
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )
        except Exception as exc:
            logger.error("Claude call failed: %s", exc)
            return {
                "error": str(exc),
                "invoice": invoice_state,
                "status": "ERROR",
            }

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text") and block.text:
                    question_for_user = block.text
            break

        if response.stop_reason != "tool_use":
            break

        tool_results: list[anthropic.types.ToolResultBlockParam] = []
        blocked = False

        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_name: str = block.name
            tool_input: dict = block.input  # type: ignore[union-attr]

            if tool_name == "flag_missing_fields" and user_message is None:
                result_str = json.dumps(
                    {"missing_fields": tool_input.get("fields", [])}
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                    }
                )
                invoice_state["missing_fields"] = tool_input.get("fields", [])
                continue

            try:
                result_str = await _dispatch_tool(tool_name, tool_input, invoice_state)
            except ArmorIQBlockedError as exc:
                logger.warning("ArmorIQ blocked: %s", exc)
                result_str = json.dumps({"blocked": True, "reason": str(exc)})
                blocked = True

            tool_results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": result_str}
            )

        messages.append({"role": "user", "content": tool_results})

        if blocked:
            break

        missing = invoice_state.get("missing_fields", [])
        if missing and user_message is None:
            break

    result: dict = {
        "invoice": invoice_state,
        "status": "PENDING_USER_INPUT"
        if invoice_state.get("missing_fields") and not user_message
        else "COMPLETE",
    }
    if question_for_user:
        result["question_for_user"] = question_for_user
    if invoice_state.get("missing_fields"):
        result["missing_fields"] = invoice_state["missing_fields"]

    return result
