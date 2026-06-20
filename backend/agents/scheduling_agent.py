import logging
import os
import anthropic

logger = logging.getLogger(__name__)

try:
    from openinference.instrumentation.anthropic import AnthropicInstrumentor
    from phoenix.otel import register
    tracer_provider = register(
        project_name="foreman-ai",
        endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces"),
    )
    AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)
except Exception as _exc:
    logger.warning("Phoenix/Arize unavailable — tracing disabled: %s", _exc)

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

SEEDED_PRICES: dict[str, float] = {
    "air filter (16x25x1)": 12.99,
    "thermostat (Honeywell T6 Pro)": 89.99,
    "capacitor (45/5 MFD dual run)": 24.50,
    "p-trap (1.5 inch PVC)": 8.75,
    "supply line (braided steel, 12in)": 6.49,
    "wax ring (toilet seal kit)": 11.99,
}

TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "propose_times",
        "description": "Propose a set of available appointment times for this job.",
        "input_schema": {
            "type": "object",
            "properties": {
                "times": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "ISO-8601 datetime strings for proposed appointment windows.",
                },
                "reasoning": {
                    "type": "string",
                    "description": "Brief explanation of why these times were chosen.",
                },
            },
            "required": ["times", "reasoning"],
        },
    },
    {
        "name": "draft_outreach",
        "description": "Draft a customer-facing outreach message to confirm the appointment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "The outreach message body.",
                },
                "channel": {
                    "type": "string",
                    "description": "Communication channel: 'sms', 'email', or 'phone'.",
                },
            },
            "required": ["message", "channel"],
        },
    },
    {
        "name": "suggest_parts",
        "description": "Suggest parts likely needed for this job. Prices are estimates only.",
        "input_schema": {
            "type": "object",
            "properties": {
                "parts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "reason": {"type": "string"},
                            "estimated_price_usd": {"type": "number"},
                        },
                        "required": ["name", "reason", "estimated_price_usd"],
                    },
                    "description": "List of suggested parts with names, reasons, and estimated prices.",
                }
            },
            "required": ["parts"],
        },
    },
]

SYSTEM_PROMPT = (
    "You are the scheduling agent for ForemanAI, a field-service management system. "
    "Given a classified work order, you must call all three tools in order: "
    "propose_times, draft_outreach, and suggest_parts. "
    "For suggest_parts, every part's 'reason' field MUST begin with 'ESTIMATED PRICE - ' "
    "to make clear the price is a guess, not a confirmed quote. "
    "Always call all three tools — do not respond in plain text."
)

_STUB_SCHEDULE: dict = {
    "proposed_times": [],
    "outreach_draft": {"message": "FALLBACK", "channel": "sms"},
    "parts_suggestion": [],
}


def _apply_seeded_prices(parts: list[dict]) -> list[dict]:
    result = []
    for part in parts:
        name_lower = part.get("name", "").lower()
        matched_price = None
        for seed_name, seed_price in SEEDED_PRICES.items():
            if any(word in name_lower for word in seed_name.split()):
                matched_price = seed_price
                break
        result.append(
            {
                "name": part.get("name", ""),
                "reason": part.get("reason", "ESTIMATED PRICE - general estimate"),
                "estimated_price_usd": matched_price
                if matched_price is not None
                else part.get("estimated_price_usd", 0.0),
            }
        )
    return result


async def run_scheduling(work_order: dict) -> dict:
    classification: dict = work_order.get("classification") or {}

    user_message = (
        f"Job type: {classification.get('job_type', 'UNKNOWN')}\n"
        f"Entities: {classification.get('entities', {})}\n"
        f"Completeness flags: {classification.get('completeness_flags', [])}\n\n"
        "Propose appointment times, draft customer outreach, and suggest parts needed."
    )

    proposed_times: list[str] = []
    outreach_draft: dict = {}
    parts_suggestion: list[dict] = []

    try:
        messages: list[anthropic.types.MessageParam] = [
            {"role": "user", "content": user_message}
        ]

        while True:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            )

            tool_calls = [b for b in response.content if b.type == "tool_use"]
            if not tool_calls:
                break

            tool_results: list[anthropic.types.ToolResultBlockParam] = []
            for block in tool_calls:
                tool_input: dict = block.input  # type: ignore[union-attr]

                if block.name == "propose_times":
                    proposed_times = tool_input.get("times", [])
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": "Times recorded.",
                        }
                    )

                elif block.name == "draft_outreach":
                    outreach_draft = {
                        "message": tool_input.get("message", ""),
                        "channel": tool_input.get("channel", "sms"),
                    }
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": "Outreach draft recorded.",
                        }
                    )

                elif block.name == "suggest_parts":
                    raw_parts = tool_input.get("parts", [])
                    parts_suggestion = _apply_seeded_prices(raw_parts)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": "Parts suggestion recorded.",
                        }
                    )

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            if response.stop_reason == "end_turn":
                break

    except Exception:
        return _STUB_SCHEDULE.copy()

    return {
        "proposed_times": proposed_times,
        "outreach_draft": outreach_draft,
        "parts_suggestion": parts_suggestion,
    }
