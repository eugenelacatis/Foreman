"""Three-scenario voice integration test, fully traced in Phoenix.

Each scenario runs a complete voice turn (STT → intake classify → gap-fill → TTS)
and emits a labelled root span so Phoenix shows them as distinct traces:

    scenario.complete_request   — all fields present, no follow-up question
    scenario.incomplete_request — missing fields, agent asks a clarifying question
    scenario.fallback_request   — ambiguous input, graceful fallback handling

Prerequisites:
    python -m backend.scripts.gen_test_audio   (creates fixtures/*.wav via TTS)

Usage (from Foreman/):
    python -m backend.scripts.test_scenarios
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from backend.agents.intake_agent import run_intake
from backend.agents.question_map import question_for_flags
from backend.agents.voice_client import LiveTranscriber, synthesize
from opentelemetry import trace

tracer = trace.get_tracer("foreman.scenarios")

FIXTURES = Path(__file__).parent / "fixtures"

# (scenario_name, audio_file, expected_behaviour_description)
SCENARIOS: list[tuple[str, str, str]] = [
    (
        "complete_request",
        "complete_request.wav",
        "All required fields present — intake should flag nothing, no follow-up TTS.",
    ),
    (
        "incomplete_request",
        "incomplete_request.wav",
        "Missing location/contact — agent should ask a clarifying question via TTS.",
    ),
    (
        "fallback_request",
        "fallback_request.wav",
        "Ambiguous input — intake returns FALLBACK flag, agent degrades gracefully.",
    ),
]


async def _stream_file(stt: LiveTranscriber, path: Path) -> None:
    with open(path, "rb") as f:
        while chunk := f.read(4096):
            await stt.send(chunk)
            await asyncio.sleep(0.05)


async def run_scenario(name: str, audio_file: str, description: str) -> None:
    audio_path = FIXTURES / audio_file

    print(f"\n{'='*60}")
    print(f"SCENARIO: {name}")
    print(f"  {description}")
    print(f"  audio: {audio_path}")
    print(f"{'='*60}")

    with tracer.start_as_current_span(f"scenario.{name}") as root:
        root.set_attribute("openinference.span.kind", "CHAIN")
        root.set_attribute("scenario.name", name)
        root.set_attribute("scenario.description", description)
        root.set_attribute("scenario.audio_file", audio_file)

        # ── 1. STT ──────────────────────────────────────────────────────────
        async with LiveTranscriber() as stt:
            if audio_path.exists():
                await _stream_file(stt, audio_path)
            else:
                print(
                    f"  [WARN] {audio_path} not found — "
                    "run gen_test_audio.py first; using seeded transcript"
                )
            transcript = await stt.finish()

        root.set_attribute("voice.transcript", transcript)
        print(f"  [STT]    heard: {transcript!r}")

        # ── 2. Intake classification (Anthropic span nests here) ─────────────
        classification = await run_intake({"raw_request": transcript})
        job_type = classification.get("job_type", "UNKNOWN")
        flags = classification.get("completeness_flags", [])
        entities = classification.get("entities", {})

        root.set_attribute("intake.job_type", job_type)
        root.set_attribute("intake.completeness_flags", flags)
        print(f"  [INTAKE] job_type={job_type}  flags={flags}")
        print(f"  [INTAKE] entities={entities}")

        # ── 3. Gap-fill decision ─────────────────────────────────────────────
        with tracer.start_as_current_span("voice.gap_fill") as gap:
            gap.set_attribute("openinference.span.kind", "TOOL")
            gap.set_attribute("scenario.name", name)
            gap.set_attribute("voice.completeness_flags", flags)
            question = question_for_flags(flags)
            gap.set_attribute("voice.complete", question is None)
            if question:
                gap.set_attribute("voice.chosen_question", question)

        if question is None:
            root.set_attribute("voice.complete", True)
            root.set_attribute("voice.outcome", "complete — no follow-up needed")
            print("  [GAP]    intake complete — no question needed")
            return

        print(f"  [GAP]    asking: {question!r}")
        root.set_attribute("voice.complete", False)
        root.set_attribute("voice.follow_up_question", question)

        # ── 4. TTS — speak the clarifying question ───────────────────────────
        audio_out = await synthesize(question)
        if audio_out is not None:
            out_path = FIXTURES.parent / f"question_{name}.wav"
            out_path.write_bytes(audio_out)
            root.set_attribute("voice.outcome", f"follow-up spoken → {out_path.name}")
            root.set_attribute("voice.has_audio", True)
            print(f"  [TTS]    wrote {len(audio_out)} bytes → {out_path}")
        else:
            root.set_attribute("voice.outcome", "follow-up text-only (TTS degraded)")
            root.set_attribute("voice.has_audio", False)
            print("  [TTS]    degraded — text-only fallback")


async def main() -> None:
    for name, audio_file, description in SCENARIOS:
        await run_scenario(name, audio_file, description)

    # Flush all spans to Phoenix before the process exits.
    print("\n[TRACE] flushing spans to Phoenix ...")
    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, "force_flush"):
            provider.force_flush()
            print("[TRACE] done — open http://localhost:6006 project 'foreman-ai'")
    except Exception as err:
        print(f"[TRACE] flush skipped: {err}")


if __name__ == "__main__":
    asyncio.run(main())
