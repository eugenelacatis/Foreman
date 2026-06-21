"""Tests for the Deepgram voice edge (Harshita — voice intake feature).

These cover the fallback behaviour that keeps the demo alive when Deepgram is
unavailable, plus the deterministic flag->question mapping.
"""

import httpx

from backend.agents import voice_client
from backend.agents.question_map import question_for_flags


# --- flag -> question map -----------------------------------------------------

def test_question_for_known_flag():
    assert question_for_flags(["MISSING_LOCATION"]) == (
        "What's the address or location for this job?"
    )


def test_question_for_unknown_flag_is_generic():
    q = question_for_flags(["SOME_NEW_FLAG"])
    assert q is not None and "more detail" in q


def test_no_flags_means_complete():
    assert question_for_flags([]) is None


def test_fallback_flag_is_ignored():
    # FALLBACK signals an internal error, not a real missing field.
    assert question_for_flags(["FALLBACK"]) is None


def test_first_actionable_flag_wins():
    assert question_for_flags(["FALLBACK", "MISSING_CONTACT_PHONE"]) == (
        "What's the best phone number to reach you on?"
    )


# --- synthesize (TTS) ---------------------------------------------------------

async def test_synthesize_returns_none_without_key(monkeypatch):
    monkeypatch.setattr(voice_client, "_DG_KEY", None)
    assert await voice_client.synthesize("hello") is None


async def test_synthesize_returns_audio_bytes(monkeypatch):
    monkeypatch.setattr(voice_client, "_DG_KEY", "test-key")

    class _Resp:
        content = b"AUDIO"

        def raise_for_status(self):
            return None

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return _Resp()

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: _Client())
    assert await voice_client.synthesize("hello") == b"AUDIO"


async def test_synthesize_falls_back_to_none_on_error(monkeypatch):
    monkeypatch.setattr(voice_client, "_DG_KEY", "test-key")

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            raise RuntimeError("network down")

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: _Client())
    assert await voice_client.synthesize("hello") is None


# --- LiveTranscriber fallback -------------------------------------------------

async def test_transcriber_degraded_returns_seeded(monkeypatch):
    monkeypatch.setattr(voice_client, "_DG_KEY", None)
    async with voice_client.LiveTranscriber() as stt:
        await stt.send(b"\x00\x01")  # no-op in degraded mode
        transcript = await stt.finish()
    assert transcript == voice_client.SEEDED_TRANSCRIPT
