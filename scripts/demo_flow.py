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
    with httpx.Client(base_url=BASE, timeout=120.0) as client:
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

        # 4a. Invoice chat — turn 1: agent prefills and asks for missing fields
        step("POST /work-orders/{id}/invoice-chat — turn 1 (gap-fill start)")
        chat1 = check(
            client.post(
                f"/work-orders/{wo_id}/invoice-chat",
                json={"message": "Please start the invoice for this work order."},
            ),
            expected=200,
        )
        print(f"Agent reply: {chat1['reply']!r}")
        missing = chat1["work_order"].get("invoice", {}).get("missing_fields", [])
        if missing:
            print(f"Missing fields flagged: {missing}")

        # 4b. Invoice chat — turn 2: provide answers to fill gaps
        # Labor rate intentionally high ($140/hr vs ~$98 avg) to trigger consistency flag
        step("POST /work-orders/{id}/invoice-chat — turn 2 (gap-fill answers)")
        chat2 = check(
            client.post(
                f"/work-orders/{wo_id}/invoice-chat",
                json={
                    "message": (
                        "Labor rate: $140/hr. "
                        "Technician hours: 3. "
                        "Trip charge: $75. "
                        "Vendor: Riverside Property Management."
                    )
                },
            ),
            expected=200,
        )
        print(f"Agent reply: {chat2['reply']!r}")
        invoice = chat2["work_order"].get("invoice", {})
        print(f"template_filled present: {bool(invoice.get('template_filled'))}")
        print(f"vendor_email_draft present: {bool(invoice.get('vendor_email_draft'))}")
        if invoice.get("template_filled"):
            print("\n--- INVOICE TEMPLATE (first 500 chars) ---")
            print(invoice["template_filled"][:500])

        # 5. Approve invoice (human gate)
        step("POST /work-orders/{id}/approve — stage=invoice")
        wo = check(
            client.post(f"/work-orders/{wo_id}/approve", json={"stage": "invoice"}),
            expected=200,
        )
        print(f"After invoice approval  status={wo['status']!r}")
        dump(wo)

        # 6. GET final state and assert complete
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
