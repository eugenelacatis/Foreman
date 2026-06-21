"""
Rehearsal script for the ForemanAI demo flow.
Requires the local server running at http://localhost:8000.
Run with: python scripts/demo_flow.py
"""

from __future__ import annotations

import sys

import httpx

BASE = "http://localhost:8001"

SEEDED_REQUEST = (
    "Repair the HVAC unit at 142 Elm Street. "
    "The compressor is making a grinding noise and the system stopped cooling yesterday. "
    "Client: Riverside Property Management. Urgency: high."
)


def step(label: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}")


def dump(data: dict) -> None:
    import json

    print(json.dumps(data, indent=2))


def check(resp: httpx.Response, expected: int = 200) -> dict:
    if resp.status_code != expected:
        print(f"ERROR {resp.status_code}: {resp.text}")
        sys.exit(1)
    return resp.json()


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        # 1. Create work order
        step("POST /work-orders — create with seeded request")
        wo = check(
            client.post("/work-orders", json={"raw_request": SEEDED_REQUEST}),
            expected=200,
        )
        wo_id = wo["id"]
        print(f"Created work order id={wo_id!r}  status={wo['status']!r}")
        dump(wo)

        # 2. Approve intake
        step("POST /work-orders/{id}/approve — stage=intake")
        wo = check(
            client.post(f"/work-orders/{wo_id}/approve", json={"stage": "intake"}),
            expected=200,
        )
        print(f"After intake approval  status={wo['status']!r}")
        dump(wo)

        # 3. Approve scheduling
        step("POST /work-orders/{id}/approve — stage=scheduling")
        wo = check(
            client.post(f"/work-orders/{wo_id}/approve", json={"stage": "scheduling"}),
            expected=200,
        )
        print(f"After scheduling approval  status={wo['status']!r}")
        dump(wo)

        # 4. Approve invoice
        step("POST /work-orders/{id}/approve — stage=invoice")
        wo = check(
            client.post(f"/work-orders/{wo_id}/approve", json={"stage": "invoice"}),
            expected=200,
        )
        print(f"After invoice approval  status={wo['status']!r}")
        dump(wo)

        # 5. GET final state and assert complete
        step("GET /work-orders/{id} — verify final status")
        wo = check(client.get(f"/work-orders/{wo_id}"), expected=200)
        dump(wo)
        assert wo["status"] == "complete", (
            f"Expected status='complete', got {wo['status']!r}"
        )

        print(f"\n{'=' * 60}")
        print("  ✅ Demo flow complete")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
