"""Generate the three test audio fixtures used by test_scenarios.py.

Synthesizes each scenario's spoken text via Deepgram TTS and writes WAV files
to backend/scripts/fixtures/.  Run this once before test_scenarios.py.

Usage (from Foreman/):
    python -m backend.scripts.gen_test_audio
"""

import asyncio
from pathlib import Path

# Registers the Phoenix tracer provider as a side-effect.
import backend.agents.intake_agent  # noqa: F401  # type: ignore[import]
from backend.agents.voice_client import synthesize

FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Three test cases mapped to the audio text a caller would actually say.
SCENARIOS: list[tuple[str, str]] = [
    (
        "complete_request.wav",
        (
            "Hi, this is John at 142 Oak Street, San Francisco. "
            "The HVAC unit on the second floor stopped working this morning. "
            "It's pretty urgent — we have staff coming in at nine. "
            "You can reach me at 415-555-0199."
        ),
    ),
    (
        "incomplete_request.wav",
        (
            "Hey, the air conditioning is broken."
        ),
    ),
    (
        "fallback_request.wav",
        (
            # Garbled / off-topic text that should trigger the FALLBACK flag.
            "Um, I don't know, something is wrong, maybe a pipe or something, "
            "I'm not sure, could be electrical, I really can't tell."
        ),
    ),
]


async def main() -> None:
    FIXTURES_DIR.mkdir(exist_ok=True)
    for filename, text in SCENARIOS:
        dest = FIXTURES_DIR / filename
        print(f"[GEN] synthesizing '{filename}' ...")
        audio = await synthesize(text)
        if audio is None:
            print(
                f"[GEN] WARN: TTS returned None for {filename} "
                "(DEEPGRAM_API_KEY missing?). File not written."
            )
        else:
            dest.write_bytes(audio)
            print(f"[GEN] OK  -> {dest} ({len(audio)} bytes)")

    from opentelemetry import trace
    provider = trace.get_tracer_provider()
    if hasattr(provider, "force_flush"):
        provider.force_flush()
    print("\n[GEN] done — run test_scenarios.py next")


if __name__ == "__main__":
    asyncio.run(main())
