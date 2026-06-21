"""Offline smoke test for the Deepgram voice edge (no server / Redis needed).

Usage (from backend/):
    python -m scripts.test_voice                  # TTS only
    python -m scripts.test_voice path\to\clip.wav # TTS + STT on a real clip

Verifies the API key actually talks to Deepgram:
  * TTS  -> synthesizes a sentence and writes tts_out.wav (play it to confirm).
  * STT  -> if you pass an audio file, streams it through LiveTranscriber and
            prints the transcript.
"""

import asyncio
import sys

# Importing intake_agent registers the Phoenix tracer provider, so the voice
# spans below are exported to Phoenix (localhost:6006) just like the server path.
import backend.agents.intake_agent  # noqa: F401
from backend.agents.voice_client import LiveTranscriber, is_configured, synthesize


async def _test_tts() -> None:
    print("[TTS] configured:", is_configured())
    audio = await synthesize(
        "Hi, this is ForemanAI. What's the address for this job?"
    )
    if audio is None:
        print("[TTS] FAILED — got None (check DEEPGRAM_API_KEY / network)")
        return
    with open("tts_out.wav", "wb") as f:
        f.write(audio)
    print(f"[TTS] OK — wrote {len(audio)} bytes to tts_out.wav (play it to confirm)")


async def _test_stt(path: str) -> None:
    print(f"[STT] streaming {path} ...")
    chunk_size = 4096
    async with LiveTranscriber() as stt:
        with open(path, "rb") as f:
            while chunk := f.read(chunk_size):
                await stt.send(chunk)
                await asyncio.sleep(0.05)  # pace it like a live mic
        transcript = await stt.finish()
    print(f"[STT] transcript: {transcript!r}")


async def _main() -> None:
    await _test_tts()
    if len(sys.argv) > 1:
        await _test_stt(sys.argv[1])
    else:
        print("[STT] skipped — pass an audio file path to test transcription")

    # Force spans out to Phoenix before the process exits.
    try:
        from opentelemetry import trace

        provider = trace.get_tracer_provider()
        if hasattr(provider, "force_flush"):
            provider.force_flush()
            print("[TRACE] flushed spans to Phoenix (check the foreman-ai project)")
    except Exception as err:
        print(f"[TRACE] flush skipped: {err}")


if __name__ == "__main__":
    asyncio.run(_main())
