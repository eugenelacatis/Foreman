"""Deterministic completeness-flag -> spoken question mapping.

Intake emits `completeness_flags` like ['MISSING_LOCATION', 'UNCLEAR_URGENCY'].
The voice loop turns the first unresolved flag into a natural follow-up question
that gets spoken back to the caller. Deterministic by design — no extra LLM call,
no latency, and demo-robust.
"""

from __future__ import annotations

# Flags intake commonly emits, mapped to a natural spoken question.
_FLAG_QUESTIONS: dict[str, str] = {
    "MISSING_LOCATION": "What's the address or location for this job?",
    "MISSING_CONTACT": "Who should we contact, and what's the best phone number?",
    "MISSING_CONTACT_NAME": "Who's the main contact for this job?",
    "MISSING_CONTACT_PHONE": "What's the best phone number to reach you on?",
    "MISSING_DESCRIPTION": "Can you describe the problem in a bit more detail?",
    "MISSING_JOB_TYPE": "What kind of work is this — for example plumbing, HVAC, or electrical?",
    "MISSING_URGENCY": "How urgent is this — is it an emergency or can it wait?",
    "UNCLEAR_URGENCY": "How soon do you need this done — is it urgent?",
    "MISSING_ASSET": "Which unit or piece of equipment is this about?",
    "UNCLEAR_LOCATION": "Could you confirm the exact address for this job?",
}

_GENERIC_QUESTION = "Could you give me a bit more detail so I can complete the request?"
_FALLBACK_QUESTION = "Could you describe the job — what needs fixing, where, and how urgent is it?"


def question_for_flags(flags: list[str]) -> str | None:
    """Return a spoken question for the first actionable flag, or None if complete.

    'FALLBACK' means intake failed to parse anything useful — ask an open-ended
    question to recover, rather than treating it as complete.
    """
    for flag in flags:
        if flag == "FALLBACK":
            return _FALLBACK_QUESTION
        return _FLAG_QUESTIONS.get(flag.upper(), _GENERIC_QUESTION)
    return None


if __name__ == "__main__":
    _SPOT_CHECKS: list[list[str]] = [
        [],
        ["FALLBACK"],
        ["MISSING_LOCATION"],
        ["MISSING_CONTACT", "MISSING_LOCATION"],
        ["UNCLEAR_URGENCY", "MISSING_ASSET"],
        ["MISSING_JOB_TYPE"],
        ["UNKNOWN_FLAG"],
    ]
    for _combo in _SPOT_CHECKS:
        print(f"flags={_combo!r:60s} -> {question_for_flags(_combo)!r}")
