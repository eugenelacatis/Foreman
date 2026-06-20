from __future__ import annotations

SEEDED_INVOICES: list[dict] = [
    {
        "id": "inv-001",
        "job_type": "HVAC repair",
        "line_items": [
            {"description": "Refrigerant recharge", "qty": 1, "unit_price": 150.00},
            {"description": "Labor (2 hrs)", "qty": 2, "unit_price": 95.00},
        ],
        "total": 340.00,
        "notes": "Residential split system, R-410A",
    },
    {
        "id": "inv-002",
        "job_type": "electrical panel upgrade",
        "line_items": [
            {"description": "200A panel install", "qty": 1, "unit_price": 1200.00},
            {"description": "Labor (6 hrs)", "qty": 6, "unit_price": 110.00},
            {"description": "Permit fee", "qty": 1, "unit_price": 85.00},
        ],
        "total": 1945.00,
        "notes": "Code upgrade, added whole-home surge protector",
    },
    {
        "id": "inv-003",
        "job_type": "plumbing leak repair",
        "line_items": [
            {
                "description": "Copper pipe section (10 ft)",
                "qty": 1,
                "unit_price": 45.00,
            },
            {"description": "Solder fittings", "qty": 4, "unit_price": 8.00},
            {"description": "Labor (1.5 hrs)", "qty": 1.5, "unit_price": 95.00},
        ],
        "total": 319.50,
        "notes": "Pinhole leak under kitchen sink, replaced 10-ft run",
    },
    {
        "id": "inv-004",
        "job_type": "drywall patch",
        "line_items": [
            {"description": "Drywall sheet (4x8)", "qty": 1, "unit_price": 22.00},
            {"description": "Joint compound + tape", "qty": 1, "unit_price": 18.00},
            {"description": "Labor (3 hrs)", "qty": 3, "unit_price": 75.00},
        ],
        "total": 265.00,
        "notes": "Water-damaged ceiling patch, two coats",
    },
    {
        "id": "inv-005",
        "job_type": "HVAC annual maintenance",
        "line_items": [
            {"description": "Filter replacement", "qty": 2, "unit_price": 25.00},
            {"description": "Coil cleaning", "qty": 1, "unit_price": 120.00},
            {"description": "Labor (1 hr)", "qty": 1, "unit_price": 95.00},
        ],
        "total": 265.00,
        "notes": "Seasonal tune-up, both units",
    },
]


async def search_invoice_history(query: str, top_k: int = 3) -> list[dict]:
    # TODO: replace with real vector search via Redis VSS (redis-py Search / FT.SEARCH)
    terms = query.lower().split()
    scored: list[tuple[int, dict]] = []
    for inv in SEEDED_INVOICES:
        haystack = (inv.get("job_type", "") + " " + inv.get("notes", "")).lower()
        score = sum(1 for t in terms if t in haystack)
        scored.append((score, inv))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [inv for _, inv in scored[:top_k]]
