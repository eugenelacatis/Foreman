import json
import logging
import os

import anthropic

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

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


def _get_trace_id() -> str | None:
    try:
        from opentelemetry import trace

        ctx = trace.get_current_span().get_span_context()
        if ctx and ctx.trace_id:
            return format(ctx.trace_id, "032x")
    except Exception:
        pass
    return None


TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "classify_job",
        "description": "Classify the incoming work order request into a structured format.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_type": {
                    "type": "string",
                    "description": "Category of work: e.g. 'HVAC', 'plumbing', 'electrical', 'carpentry', 'general'",
                },
                "entities": {
                    "type": "object",
                    "description": "Extracted entities: {location, urgency, contact_name, contact_phone, asset_id, description}",
                },
                "completeness_flags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of missing or unclear fields, e.g. ['MISSING_LOCATION', 'UNCLEAR_URGENCY']",
                },
            },
            "required": ["job_type", "entities", "completeness_flags"],
        },
    }
]

SYSTEM_PROMPT = (
    "You are the intake classifier for ForemanAI, a field-service management system. "
    "Given a raw work order request, call the classify_job tool to extract the job type, "
    "relevant entities, and any completeness flags for missing information. "
    "Always call the tool — do not respond in plain text.\n\n"
    "completeness_flags rules:\n"
    "- Only flag MISSING_LOCATION if no address or site name is mentioned.\n"
    "- Only flag MISSING_DESCRIPTION if the problem is completely unclear.\n"
    "- Only flag MISSING_CONTACT if there is no contact name AND no on-site contact mentioned.\n"
    "- Do NOT flag MISSING_URGENCY or UNCLEAR_URGENCY if a PO number, rate, or terms are provided — "
    "those indicate a pre-scheduled commercial job, not an emergency.\n"
    "- Do NOT flag MISSING_CONTACT_PHONE for commercial jobs with a PO number.\n"
    "- If the request is complete enough to dispatch a technician, return an empty completeness_flags list."
)

_STUB_CLASSIFICATION: dict = {
    "job_type": "UNKNOWN",
    "entities": {},
    "completeness_flags": ["FALLBACK"],
}


async def run_intake(work_order: dict) -> dict:
    raw_request: str = work_order.get("raw_request", "")

    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=[{"role": "user", "content": raw_request}],
        )
        trace_id = _get_trace_id()
    except Exception as exc:
        logger.error("intake API call failed: %s", exc, exc_info=True)
        return _STUB_CLASSIFICATION.copy()

    for block in response.content:
        if block.type == "tool_use" and block.name == "classify_job":
            tool_input: dict = block.input  # type: ignore[union-attr]
            return {
                "job_type": tool_input.get("job_type", "UNKNOWN"),
                "entities": tool_input.get("entities", {}),
                "completeness_flags": tool_input.get("completeness_flags", []),
                "trace_id": trace_id,
            }

    return _STUB_CLASSIFICATION.copy()
