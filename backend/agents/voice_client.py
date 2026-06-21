"""Deepgram voice edge for ForemanAI intake."""

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

tracer = trace.get_tracer("foreman.voice")

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_DG_KEY = os.getenv("DEEPGRAM_API_KEY")

_LISTEN_PARAMS = {
    "model": os.getenv("DEEPGRAM_STT_MODEL", "nova-2"),
    "smart_format": "true",
    "interim_results": "false",
    "punctuate": "true",
    "encoding": "opus",
    "container": "webm",
}
_LISTEN_URL = "wss://api.deepgram.com/v1/listen?" + urlencode(_LISTEN_PARAMS)

_SPEAK_MODEL = os.getenv("DEEPGRAM_TTS_MODEL", "aura-asteria-en")
_SPEAK_URL = (
    "https://api.deepgram.com/v1/speak?"
    + urlencode({"model": _SPEAK_MODEL, "encoding": "linear16", "sample_rate": "24000"})
)

SEEDED_TRANSCRIPT = ""


def is_configured() -> bool:
    return bool(_DG_KEY)


async def synthesize(text: str) -> bytes | None:
    with tracer.start_as_current_span("voice.tts") as span:
        span.set_attribute("openinference.span.kind", "TOOL")
        span.set_attribute("input.value", text)
        if not _DG_KEY:
            span.set_attribute("voice.degraded", True)
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as http:
                resp = await http.post(
                    _SPEAK_URL,
                    headers={"Authorization": f"Token {_DG_KEY}", "Content-Type": "application/json"},
                    json={"text": text},
                )
                resp.raise_for_status()
                span.set_attribute("voice.degraded", False)
                return resp.content
        except Exception as err:
            logger.warning("Deepgram TTS failed (%s)", err)
            span.set_attribute("voice.degraded", True)
            return None


class LiveTranscriber:
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
            logger.error("Deepgram connect failed (%s) — degraded", err)
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
            logger.warning("Deepgram send failed (%s)", err)
            self._degraded = True

    async def finish(self) -> str:
        with tracer.start_as_current_span("voice.stt") as span:
            span.set_attribute("openinference.span.kind", "TOOL")
            if self._degraded or self._ws is None:
                span.set_attribute("voice.degraded", True)
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

            transcript = " ".join(self._finals).strip()
            span.set_attribute("voice.degraded", not transcript)
            span.set_attribute("voice.transcript", transcript)
            return transcript or SEEDED_TRANSCRIPT
