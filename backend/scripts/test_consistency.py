"""
Test consistency check — high-rate and high-trip-charge flags fire correctly.

No API keys required — calls _tool_check_consistency directly.

Run:
    python3.11 -m backend.scripts.test_consistency
"""

from __future__ import annotations

from backend.agents.invoicing_agent import _tool_check_consistency
from backend.seeds.invoice_history import INVOICE_HISTORY

HVAC_HISTORY = [h for h in INVOICE_HISTORY if h.get("job_type", "").upper() == "HVAC"]


def test_labor_rate_high_flag() -> None:
    invoice_draft = {
        "rates": {"labor_per_hour": 200.00, "trip_charge": 65.00},
        "line_items": [],
    }
    result = _tool_check_consistency(invoice_draft, HVAC_HISTORY)
    flags = result["consistency_flags"]
    assert any("LABOR_RATE_HIGH" in f for f in flags), (
        f"Expected LABOR_RATE_HIGH flag, got: {flags}"
    )
    print(
        f"[PASS] LABOR_RATE_HIGH fired: {[f for f in flags if 'LABOR_RATE_HIGH' in f]}"
    )


def test_labor_rate_low_flag() -> None:
    invoice_draft = {
        "rates": {"labor_per_hour": 30.00, "trip_charge": 65.00},
        "line_items": [],
    }
    result = _tool_check_consistency(invoice_draft, HVAC_HISTORY)
    flags = result["consistency_flags"]
    assert any("LABOR_RATE_LOW" in f for f in flags), (
        f"Expected LABOR_RATE_LOW flag, got: {flags}"
    )
    print(f"[PASS] LABOR_RATE_LOW fired: {[f for f in flags if 'LABOR_RATE_LOW' in f]}")


def test_trip_charge_high_flag() -> None:
    # HVAC avg trip charge: (65 + 0 + 80) / 3 = ~48.33; 1.5x = ~72.5 → 200 should fire
    invoice_draft = {
        "rates": {"labor_per_hour": 95.00, "trip_charge": 200.00},
        "line_items": [],
    }
    result = _tool_check_consistency(invoice_draft, HVAC_HISTORY)
    flags = result["consistency_flags"]
    assert any("TRIP_CHARGE_HIGH" in f for f in flags), (
        f"Expected TRIP_CHARGE_HIGH flag, got: {flags}"
    )
    print(
        f"[PASS] TRIP_CHARGE_HIGH fired: {[f for f in flags if 'TRIP_CHARGE_HIGH' in f]}"
    )


def test_normal_rates_no_flags() -> None:
    invoice_draft = {
        "rates": {"labor_per_hour": 95.00, "trip_charge": 65.00},
        "line_items": [],
    }
    result = _tool_check_consistency(invoice_draft, HVAC_HISTORY)
    flags = result["consistency_flags"]
    assert flags == [], f"Expected no flags for normal rates, got: {flags}"
    print("[PASS] normal rates: no flags")


def test_history_count_returned() -> None:
    invoice_draft = {"rates": {}, "line_items": []}
    result = _tool_check_consistency(invoice_draft, HVAC_HISTORY)
    assert result["history_count"] == len(HVAC_HISTORY), (
        f"Expected history_count={len(HVAC_HISTORY)}, got {result['history_count']}"
    )
    print(f"[PASS] history_count={result['history_count']}")


if __name__ == "__main__":
    print("=== consistency check tests ===")
    test_labor_rate_high_flag()
    test_labor_rate_low_flag()
    test_trip_charge_high_flag()
    test_normal_rates_no_flags()
    test_history_count_returned()
    print()
    print("All consistency tests passed.")
