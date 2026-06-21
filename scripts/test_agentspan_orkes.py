"""
Test script for the Agentspan Orkes integration.

Requires:
  - ForemanAI server running at http://localhost:8001
  - Agentspan server running at http://localhost:6767
  - Redis running at localhost:6379

Run with:
  python scripts/test_agentspan_orkes.py
"""

from __future__ import annotations

import json
import sys

import httpx

BASE = "http://localhost:8001"
AGENTSPAN_BASE = "http://localhost:6767"

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
    print(json.dumps(data, indent=2))


def check(resp: httpx.Response, expected: int = 200) -> dict:
    if resp.status_code != expected:
        print(f"ERROR {resp.status_code}: {resp.text}")
        sys.exit(1)
    return resp.json()


def approve(client: httpx.Client, work_order_id: str, stage: str) -> dict:
    return check(
        client.post(
            f"/orkes/agentspan/work-orders/{work_order_id}/approve",
            json={"stage": stage},
        )
    )


def main() -> None:
    with httpx.Client(base_url=BASE, timeout=120.0) as client:

        # ── 0. Verify Agentspan server is up ──────────────────────────────
        step("Pre-check: Agentspan server reachability")
        try:
            probe = httpx.get(f"{AGENTSPAN_BASE}/health", timeout=3.0)
            print(f"Agentspan /health → {probe.status_code}")
            if probe.status_code >= 500:
                print("ERROR: Agentspan server returned 5xx — is it running?")
                sys.exit(1)
        except Exception as exc:
            print(f"ERROR: Cannot reach Agentspan at {AGENTSPAN_BASE} — {exc}")
            print("Start the Agentspan server and retry.")
            sys.exit(1)

        # ── 1. POST /orkes/agentspan/work-orders ──────────────────────────
        step("POST /orkes/agentspan/work-orders — seeded HVAC request")
        resp = check(
            client.post(
                "/orkes/agentspan/work-orders",
                json={"raw_request": SEEDED_REQUEST},
            )
        )
        execution_id = resp["execution_id"]
        work_order_id = resp["work_order_id"]
        print(f"execution_id   = {execution_id!r}")
        print(f"work_order_id  = {work_order_id!r}")
        print(f"status         = {resp['status']!r}")
        print(f"current_stage  = {resp['current_stage']!r}")
        print(f"waiting_for    = {resp['waiting_for']!r}")
        print(f"agentspan_url  = {resp['agentspan_url']!r}")

        assert resp["status"] == "started", f"Expected status='started', got {resp['status']!r}"
        assert resp["current_stage"] == "create_work_order"
        assert resp["waiting_for"] == "WAITING_FOR_INTAKE_APPROVAL"

        # ── 2. GET initial Agentspan status ───────────────────────────────
        step(f"GET /orkes/agentspan/status/{execution_id} — initial")
        status_resp = check(client.get(f"/orkes/agentspan/status/{execution_id}"))
        print(f"agentspan_status = {status_resp['agentspan_status']!r}")
        print(f"current_stage    = {status_resp['current_stage']!r}")
        print(f"waiting_for      = {status_resp['waiting_for']!r}")

        assert status_resp["execution_id"] == execution_id
        assert status_resp["work_order_id"] == work_order_id
        assert status_resp["work_order"] is not None
        assert status_resp["waiting_for"] == "WAITING_FOR_INTAKE_APPROVAL"

        # ── 3. Confirm WorkOrder in Redis via existing endpoint ───────────
        step(f"GET /work-orders/{work_order_id} — verify WorkOrder in Redis")
        wo_resp = check(client.get(f"/work-orders/{work_order_id}"))
        assert wo_resp["id"] == work_order_id
        assert wo_resp["status"] == "intake"
        print(f"id={wo_resp['id']!r}  status={wo_resp['status']!r}  ✓")

        # ── 4. Approve intake ─────────────────────────────────────────────
        step("POST /orkes/agentspan/work-orders/{id}/approve — stage=intake")
        intake_resp = approve(client, work_order_id, "intake")
        print(f"current_stage = {intake_resp['current_stage']!r}")
        print(f"waiting_for   = {intake_resp['waiting_for']!r}")
        print(f"status        = {intake_resp['status']!r}")
        classification = (intake_resp["work_order"] or {}).get("classification")
        print(f"classification: {json.dumps(classification, indent=2)}")

        assert intake_resp["waiting_for"] == "WAITING_FOR_SCHEDULING_APPROVAL", (
            f"Expected WAITING_FOR_SCHEDULING_APPROVAL, got {intake_resp['waiting_for']!r}"
        )
        print("Intake approved — WAITING_FOR_SCHEDULING_APPROVAL ✓")

        # ── 5. Approve scheduling ─────────────────────────────────────────
        step("POST /orkes/agentspan/work-orders/{id}/approve — stage=scheduling")
        sched_resp = approve(client, work_order_id, "scheduling")
        print(f"current_stage = {sched_resp['current_stage']!r}")
        print(f"waiting_for   = {sched_resp['waiting_for']!r}")
        print(f"status        = {sched_resp['status']!r}")
        schedule = (sched_resp["work_order"] or {}).get("schedule")
        if schedule:
            print(f"proposed_times: {schedule.get('proposed_times')}")
            print(f"parts count:    {len(schedule.get('parts_suggestion', []))}")

        assert sched_resp["waiting_for"] == "WAITING_FOR_INVOICE_APPROVAL", (
            f"Expected WAITING_FOR_INVOICE_APPROVAL, got {sched_resp['waiting_for']!r}"
        )
        print("Scheduling approved — WAITING_FOR_INVOICE_APPROVAL ✓")

        # ── 6. Approve invoice ────────────────────────────────────────────
        step("POST /orkes/agentspan/work-orders/{id}/approve — stage=invoice")
        inv_resp = approve(client, work_order_id, "invoice")
        print(f"current_stage = {inv_resp['current_stage']!r}")
        print(f"waiting_for   = {inv_resp['waiting_for']!r}")
        print(f"status        = {inv_resp['status']!r}")

        assert inv_resp["status"] == "complete", (
            f"Expected status='complete', got {inv_resp['status']!r}"
        )
        assert inv_resp["waiting_for"] is None, (
            f"Expected waiting_for=null after invoice approval, got {inv_resp['waiting_for']!r}"
        )
        assert inv_resp["work_order"]["status"] == "complete"
        print("Invoice approved — status=complete, waiting_for=null ✓")

        # ── 7. Final GET /orkes/agentspan/status ──────────────────────────
        step(f"GET /orkes/agentspan/status/{execution_id} — final")
        final_status = check(client.get(f"/orkes/agentspan/status/{execution_id}"))
        print(f"agentspan_status = {final_status['agentspan_status']!r}")
        print(f"current_stage    = {final_status['current_stage']!r}")
        print(f"waiting_for      = {final_status['waiting_for']!r}")
        dump(final_status)

        # ── 8. Verify existing pipeline is untouched ──────────────────────
        step("Verify existing /work-orders endpoint still works (no side effects)")
        fresh = check(
            client.post(
                "/work-orders",
                json={"raw_request": "Plumbing leak at 99 Oak St."},
            )
        )
        print(f"Existing pipeline created work order id={fresh['id']!r}  ✓")

        print(f"\n{'=' * 60}")
        print("  ✅ Agentspan Orkes integration test complete")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
