import json
import os
import anthropic
from openinference.instrumentation.anthropic import AnthropicInstrumentor
from phoenix.otel import register

from dotenv import load_dotenv

load_dotenv()

tracer_provider = register(
    project_name="foreman-ai",
    endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006/v1/traces"),
)
AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

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
    "Always call the tool — do not respond in plain text."
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
    except Exception:
        return _STUB_CLASSIFICATION.copy()

    for block in response.content:
        if block.type == "tool_use" and block.name == "classify_job":
            tool_input: dict = block.input  # type: ignore[union-attr]
            return {
                "job_type": tool_input.get("job_type", "UNKNOWN"),
                "entities": tool_input.get("entities", {}),
                "completeness_flags": tool_input.get("completeness_flags", []),
            }

    return _STUB_CLASSIFICATION.copy()
