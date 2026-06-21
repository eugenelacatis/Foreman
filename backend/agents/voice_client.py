"""Deepgram voice edge for ForemanAI intake.

Two halves, both wrapped so any failure degrades gracefully and never breaks
the demo (per CLAUDE.md "Path B"):

* ``LiveTranscriber`` — real-time speech-to-text. Streams audio chunks to
  Deepgram's live websocket and returns the final transcript for a turn.
* ``synthesize`` — text-to-speech via Deepgram Aura. Turns the agent's
  follow-up question into audio bytes the client can play.

This module wraps the *outside* of intake — it never touches agent reasoning.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from opentelemetry import trace

logger = logging.getLogger(__name__)

# Reuses the tracer_provider that intake_agent registers with Phoenix at import.
tracer = trace.get_tracer("foreman.voice")

# Load backend/.env explicitly so the key resolves no matter the working dir.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_DG_KEY = os.getenv("DEEPGRAM_API_KEY")

# Live STT websocket. We let Deepgram auto-detect the container (browser
# MediaRecorder emits webm/opus), so we only set model + formatting params.
_LISTEN_PARAMS = {
    "model": os.getenv("DEEPGRAM_STT_MODEL", "nova-2"),
    "smart_format": "true",
    "interim_results": "false",
    "punctuate": "true",
    "encoding": "opus",
    "container": "webm",
}
_LISTEN_URL = "wss://api.deepgram.com/v1/listen?" + urlencode(_LISTEN_PARAMS)

# Aura TTS REST endpoint.
_SPEAK_MODEL = os.getenv("DEEPGRAM_TTS_MODEL", "aura-asteria-en")
_SPEAK_URL = (
    "https://api.deepgram.com/v1/speak?"
    + urlencode({"model": _SPEAK_MODEL, "encoding": "linear16", "sample_rate": "24000"})
)

# Seeded transcript used when Deepgram is unavailable, so the loop still runs.
SEEDED_TRANSCRIPT = (
    "The air conditioning unit at the office stopped working this morning."
)


def is_configured() -> bool:
    return bool(_DG_KEY)


async def synthesize(text: str) -> bytes | None:
    """Return TTS audio for ``text``, or None on any failure (text-only fallback)."""
    with tracer.start_as_current_span("voice.tts") as span:
        span.set_attribute("openinference.span.kind", "TOOL")
        span.set_attribute("input.value", text)
        span.set_attribute("voice.tts.model", _SPEAK_MODEL)
        span.set_attribute("voice.tts.text", text)
        if not _DG_KEY:
            logger.warning("DEEPGRAM_API_KEY unset — skipping TTS, falling back to text")
            span.set_attribute("voice.degraded", True)
            span.set_attribute("output.value", "[degraded] text-only, no audio")
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as http:
                resp = await http.post(
                    _SPEAK_URL,
                    headers={
                        "Authorization": f"Token {_DG_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"text": text},
                )
                resp.raise_for_status()
                span.set_attribute("voice.degraded", False)
                span.set_attribute("voice.tts.audio_bytes", len(resp.content))
                span.set_attribute("output.value", f"{len(resp.content)} bytes of audio")
                return resp.content
        except Exception as err:
            logger.warning("Deepgram TTS failed (%s) — falling back to text-only", err)
            span.set_attribute("voice.degraded", True)
            span.set_attribute("voice.error", str(err))
            span.set_attribute("output.value", f"[degraded] {err}")
            return None


class LiveTranscriber:
    """Streams audio to Deepgram live STT and collects final transcripts.

    Usage::

        async with LiveTranscriber() as stt:
            async for chunk in client_audio:
                await stt.send(chunk)
            transcript = await stt.finish()

    If Deepgram is unreachable, ``finish()`` returns the seeded transcript so the
    intake loop still has something to classify.
    """

    def __init__(self) -> None:
        self._ws = None
        self._recv_task = None
        self._finals: list[str] = []
        self._degraded = not _DG_KEY

    async def __aenter__(self) -> "LiveTranscriber":
        if self._degraded:
            return self
        try:
            import asyncio

            from websockets.asyncio.client import connect

            self._ws = await connect(
                _LISTEN_URL,
                additional_headers={"Authorization": f"Token {_DG_KEY}"},
            )
            self._recv_task = asyncio.create_task(self._receive_loop())
        except Exception as err:
            logger.error("Deepgram live connect failed (%s) — degraded mode", err, exc_info=True)
            self._degraded = True
            self._ws = None
        return self

    async def __aexit__(self, *_exc) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass

    async def _receive_loop(self) -> None:
        try:
            async for raw in self._ws:  # type: ignore[union-attr]
                try:
                    msg = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                if msg.get("type") != "Results":
                    continue
                alt = (msg.get("channel", {}).get("alternatives") or [{}])[0]
                text = alt.get("transcript", "").strip()
                if text and msg.get("is_final"):
                    self._finals.append(text)
        except Exception as err:
            logger.warning("Deepgram receive loop ended (%s)", err)

    async def send(self, chunk: bytes) -> None:
        if self._degraded or self._ws is None:
            return
        try:
            await self._ws.send(chunk)
        except Exception as err:
            logger.warning("Deepgram send failed (%s) — degrading", err)
            self._degraded = True

    async def finish(self) -> str:
        """Signal end of audio, wait for Deepgram to drain, return the transcript."""
        with tracer.start_as_current_span("voice.stt") as span:
            span.set_attribute("openinference.span.kind", "TOOL")
            span.set_attribute("input.value", "audio stream")
            span.set_attribute("voice.stt.model", _LISTEN_PARAMS["model"])
            if self._degraded or self._ws is None:
                span.set_attribute("voice.degraded", True)
                span.set_attribute("voice.transcript", SEEDED_TRANSCRIPT)
                span.set_attribute("output.value", SEEDED_TRANSCRIPT)
                return SEEDED_TRANSCRIPT
            try:
                import asyncio

                await self._ws.send(json.dumps({"type": "CloseStream"}))
                if self._recv_task is not None:
                    try:
                        await asyncio.wait_for(self._recv_task, timeout=5.0)
                    except asyncio.TimeoutError:
                        self._recv_task.cancel()
            except Exception as err:
                logger.warning("Deepgram finish failed (%s)", err)
                span.set_attribute("voice.error", str(err))

            transcript = " ".join(self._finals).strip()
            degraded = not transcript
            span.set_attribute("voice.degraded", degraded)
            result = transcript or SEEDED_TRANSCRIPT
            span.set_attribute("voice.transcript", result)
            span.set_attribute("output.value", result)
            return result
