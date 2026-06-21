import json
import logging
import os
import uuid
from datetime import date

import anthropic
from opentelemetry import trace as _otel_trace

from .armoriq_client import ArmorIQBlockedError, check_action, sign_plan
from .invoice_template import render_template
from ..seeds.invoice_history import INVOICE_HISTORY

logger = logging.getLogger(__name__)
_tracer = _otel_trace.get_tracer(__name__)


def _get_trace_id() -> str | None:
    try:
        ctx = _otel_trace.get_current_span().get_span_context()
        if ctx and ctx.trace_id:
            return format(ctx.trace_id, "032x")
    except Exception:
        pass
    return None


try:
    from openinference.instrumentation.anthropic import AnthropicInstrumentor
    from phoenix.otel import register

    tracer_provider = register(
        project_name="foreman-ai",
        endpoint=os.getenv(
            "PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces"
        ),
    )
    AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)
    logger.info("Phoenix tracing enabled")
except Exception as _phoenix_err:
    logger.warning("Phoenix tracing unavailable: %s", _phoenix_err)

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
    "Your job is to produce a complete, accurate invoice from a work order that has already "
    "been through intake and scheduling. You work in turns with the user to fill any gaps.\n\n"
    "On the first turn:\n"
    "1. Call prefill_invoice with every field you can derive from the work order context.\n"
    "2. Call flag_missing_fields for anything that requires user input (rates, hours, extras).\n"
    "   Stop here and wait — do not proceed to fill_template until all gaps are resolved.\n\n"
    "On subsequent turns (when the user has provided missing information):\n"
    "3. Do NOT call prefill_invoice or flag_missing_fields again — those steps are already done.\n"
    "4. Call check_consistency, passing the updated draft and the invoice history provided.\n"
    "5. Call fill_template with the complete invoice data.\n"
    "6. Call draft_vendor_email to produce the notification draft.\n\n"
    "fill_template and draft_vendor_email are guarded by ArmorIQ — they require a valid approved "
    "plan and will not run without human sign-off. Never skip this gate.\n"
    "Always call a tool — never respond in plain text alone."
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
        with _tracer.start_as_current_span("invoicing.armoriq_check") as span:
            span.set_attribute("action", tool_name)
            plan_id = await sign_plan(action=tool_name, plan=tool_input)
            result = await check_action(action=tool_name, plan_id=plan_id)
            span.set_attribute("allowed", result["allowed"])
        if not result["allowed"]:
            raise ArmorIQBlockedError(
                f"ArmorIQ blocked action: {tool_name} — {result['reason']}"
            )

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
        with _tracer.start_as_current_span("invoicing.consistency_check") as span:
            result = _tool_check_consistency(
                tool_input["invoice_draft"], tool_input["history_results"]
            )
            span.set_attribute("flags_count", len(result["consistency_flags"]))
            span.set_attribute("history_count", result["history_count"])
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


async def run_invoicing(
    work_order: dict,
    user_message: str | None = None,
    prior_invoice: dict | None = None,
) -> dict:
    history = _get_history(work_order)

    # Resume from prior conversation if available
    prior = prior_invoice or {}
    saved_history: list = prior.get("conversation_history", [])
    invoice_state: dict = {
        k: v
        for k, v in prior.items()
        if k not in ("conversation_history", "missing_fields")
        and v not in (None, [], {})
    }

    if saved_history and user_message:
        # Continuing an existing conversation — append the new user message
        messages: list[anthropic.types.MessageParam] = list(saved_history)
        messages.append({"role": "user", "content": user_message})
    else:
        # Fresh start — build full context as the opening user turn
        context_parts = [
            f"Work order ID: {work_order.get('id', 'UNKNOWN')}",
            f"Raw request: {work_order.get('raw_request', '')}",
            f"Classification: {json.dumps(work_order.get('classification', {}))}",
            f"Schedule: {json.dumps(work_order.get('schedule', {}))}",
            f"Invoice history ({len(history)} records): {json.dumps(history)}",
        ]
        if user_message:
            context_parts.append(f"User clarification: {user_message}")
        messages = [{"role": "user", "content": "\n\n".join(context_parts)}]

    question_for_user: str | None = None
    turn_number = 0

    while True:
        turn_number += 1
        with _tracer.start_as_current_span("invoicing.gap_fill_turn") as span:
            span.set_attribute("turn_number", turn_number)
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
            span.set_attribute("stop_reason", response.stop_reason or "")

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

    still_missing = invoice_state.get("missing_fields", [])
    result: dict = {
        "invoice": invoice_state,
        "conversation_history": messages,
        "status": "PENDING_USER_INPUT" if still_missing else "COMPLETE",
        "trace_id": _get_trace_id(),
    }
    if question_for_user:
        result["question_for_user"] = question_for_user
    if still_missing:
        result["missing_fields"] = still_missing

    return result
