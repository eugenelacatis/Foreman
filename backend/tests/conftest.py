"""Test fixtures for the front-of-lifecycle agents (intake + scheduling).

The agent modules call ``phoenix.otel.register()`` and
``AnthropicInstrumentor().instrument()`` at import time. To keep tests
deterministic and offline, we stub those out *before* the agents are
imported, and provide a small builder for fake Anthropic responses so no
API key or network is required.
"""

import os
import sys
import types

import pytest

# Ensure the Anthropic client can construct even without a real key.
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")


def _install_tracing_stubs() -> None:
    """Replace Phoenix / OpenInference imports with no-ops at import time."""
    if "phoenix.otel" not in sys.modules:
        phoenix = types.ModuleType("phoenix")
        otel = types.ModuleType("phoenix.otel")
        otel.register = lambda *a, **k: object()  # returns a dummy tracer_provider
        phoenix.otel = otel
        sys.modules.setdefault("phoenix", phoenix)
        sys.modules["phoenix.otel"] = otel

    mod_name = "openinference.instrumentation.anthropic"
    if mod_name not in sys.modules:
        oi = types.ModuleType("openinference")
        instr = types.ModuleType("openinference.instrumentation")
        anth = types.ModuleType(mod_name)

        class _Instrumentor:
            def instrument(self, *a, **k):
                return None

        anth.AnthropicInstrumentor = _Instrumentor
        sys.modules.setdefault("openinference", oi)
        sys.modules.setdefault("openinference.instrumentation", instr)
        sys.modules[mod_name] = anth


_install_tracing_stubs()


# --- fake Anthropic response builders ----------------------------------------

class FakeToolUse:
    type = "tool_use"

    def __init__(self, name: str, input: dict, id: str = "tu_1"):
        self.name = name
        self.input = input
        self.id = id


class FakeText:
    type = "text"

    def __init__(self, text: str = ""):
        self.text = text


class FakeResponse:
    def __init__(self, content: list, stop_reason: str = "tool_use"):
        self.content = content
        self.stop_reason = stop_reason


@pytest.fixture
def tool_use():
    return FakeToolUse


@pytest.fixture
def make_response():
    def _make(content, stop_reason="tool_use"):
        return FakeResponse(content, stop_reason)

    return _make
