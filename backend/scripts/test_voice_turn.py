"""End-to-end voice TURN driver — no server, no Redis required.

Runs the exact logic the /ws/work-orders/voice route runs for one turn, minus
persistence, so you can watch the full nested trace in Phoenix:

    voice.turn
    ├─ voice.stt        (audio file -> transcript)
    ├─ intake.classify  (Anthropic span, auto-nested)
    ├─ voice.gap_fill   (completeness_flags -> chosen question)
    └─ voice.tts        (question -> question_audio.wav)

Usage (from Foreman/):
    python -m backend.scripts.test_voice_turn path\to\clip.wav

If no clip is given it falls back to the seeded transcript so you can still see
the gap-fill + TTS half of the flow.
"""

import asyncio
import sys

# intake_agent registers the Phoenix tracer AND gives us run_intake directly,
# so we avoid importing pipeline (which pulls in Redis).
from backend.agents.intake_agent import run_intake
from backend.agents.question_map import question_for_flags
from backend.agents.voice_client import LiveTranscriber, synthesize
from opentelemetry import trace

tracer = trace.get_tracer("foreman.voice")


async def _stream_file(stt: LiveTranscriber, path: str) -> None:
    with open(path, "rb") as f:
        while chunk := f.read(4096):
            await stt.send(chunk)
            await asyncio.sleep(0.05)  # pace like a live mic


async def run_turn(audio_path: str | None) -> None:
    with tracer.start_as_current_span("voice.turn") as turn_span:
        turn_span.set_attribute("work_order.id", "voice-turn-test")

        # 1. speech -> text
        async with LiveTranscriber() as stt:
            if audio_path:
                await _stream_file(stt, audio_path)
            transcript = await stt.finish()
        turn_span.set_attribute("voice.transcript", transcript)
        print(f"[STT] heard: {transcript!r}")

        # 2. intake classification (Anthropic span nests under voice.turn)
        classification = await run_intake({"raw_request": transcript})
        flags = classification.get("completeness_flags", [])
        print(f"[INTAKE] job_type={classification.get('job_type', '?')} flags={flags}")

        # 3. gap-fill decision
        with tracer.start_as_current_span("voice.gap_fill") as gap_span:
            gap_span.set_attribute("voice.completeness_flags", flags)
            question = question_for_flags(flags)
            gap_span.set_attribute("voice.complete", question is None)
            if question is not None:
                gap_span.set_attribute("voice.chosen_question", question)

        if question is None:
            turn_span.set_attribute("voice.complete", True)
            print("[GAP-FILL] nothing missing — intake complete, no question asked")
            return

        print(f"[GAP-FILL] asking: {question!r}")

        # 4. text -> speech (the spoken follow-up)
        audio = await synthesize(question)
        turn_span.set_attribute("voice.has_audio", audio is not None)
        if audio is not None:
            with open("question_audio.wav", "wb") as f:
                f.write(audio)
            print(f"[TTS] wrote {len(audio)} bytes to question_audio.wav (play it)")
        else:
            print("[TTS] no audio (degraded) — text-only fallback")


async def _main() -> None:
    audio_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not audio_path:
        print("[note] no audio file given — using seeded transcript\n")
    await run_turn(audio_path)

    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, "force_flush"):
            provider.force_flush()
            print("\n[TRACE] flushed — open http://localhost:6006 project 'foreman-ai'")
    except Exception as err:
        print(f"[TRACE] flush skipped: {err}")


if __name__ == "__main__":
    asyncio.run(_main())
