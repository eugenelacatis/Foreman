INVOICE_HISTORY: list[dict] = [
    {
        "vendor_name": "Arctic Air HVAC Services",
        "job_type": "HVAC",
        "line_items": [
            {
                "description": "Refrigerant recharge (R-410A, 2 lbs)",
                "qty": 2,
                "unit_price": 85.00,
                "total": 170.00,
            },
            {
                "description": "Capacitor replacement",
                "qty": 1,
                "unit_price": 45.00,
                "total": 45.00,
            },
            {
                "description": "Labor — diagnostic + repair (2.5 hrs)",
                "qty": 2.5,
                "unit_price": 95.00,
                "total": 237.50,
            },
        ],
        "rates": {"labor_per_hour": 95.00, "trip_charge": 65.00},
        "total": 517.50,
        "date": "2025-11-14",
    },
    {
        "vendor_name": "Blue Ridge Plumbing Co.",
        "job_type": "plumbing",
        "line_items": [
            {
                "description": "Water heater replacement (40-gal, gas)",
                "qty": 1,
                "unit_price": 620.00,
                "total": 620.00,
            },
            {
                "description": "Labor — removal + install (3 hrs)",
                "qty": 3,
                "unit_price": 110.00,
                "total": 330.00,
            },
            {
                "description": "Permit fee",
                "qty": 1,
                "unit_price": 75.00,
                "total": 75.00,
            },
        ],
        "rates": {"labor_per_hour": 110.00, "trip_charge": 75.00},
        "total": 1100.00,
        "date": "2025-12-02",
    },
    {
        "vendor_name": "Arctic Air HVAC Services",
        "job_type": "HVAC",
        "line_items": [
            {
                "description": "Annual preventive maintenance — commercial RTU",
                "qty": 1,
                "unit_price": 250.00,
                "total": 250.00,
            },
            {
                "description": "Filter replacement (MERV-13, qty 4)",
                "qty": 4,
                "unit_price": 22.00,
                "total": 88.00,
            },
            {
                "description": "Labor — PM inspection (1.5 hrs)",
                "qty": 1.5,
                "unit_price": 95.00,
                "total": 142.50,
            },
        ],
        "rates": {"labor_per_hour": 95.00, "trip_charge": 0.00},
        "total": 480.50,
        "date": "2026-01-08",
    },
    {
        "vendor_name": "Summit Mechanical Group",
        "job_type": "HVAC",
        "line_items": [
            {
                "description": "Evaporator coil replacement",
                "qty": 1,
                "unit_price": 840.00,
                "total": 840.00,
            },
            {
                "description": "Refrigerant recharge (R-22, 1.5 lbs)",
                "qty": 1.5,
                "unit_price": 120.00,
                "total": 180.00,
            },
            {
                "description": "Labor — coil R&R (5 hrs)",
                "qty": 5,
                "unit_price": 105.00,
                "total": 525.00,
            },
        ],
        "rates": {"labor_per_hour": 105.00, "trip_charge": 80.00},
        "total": 1625.00,
        "date": "2026-02-19",
    },
    {
        "vendor_name": "Blue Ridge Plumbing Co.",
        "job_type": "plumbing",
        "line_items": [
            {
                "description": "Backflow preventer replacement (1-inch)",
                "qty": 1,
                "unit_price": 185.00,
                "total": 185.00,
            },
            {
                "description": "Shut-off valve replacement",
                "qty": 2,
                "unit_price": 55.00,
                "total": 110.00,
            },
            {
                "description": "Labor — valve work (2 hrs)",
                "qty": 2,
                "unit_price": 110.00,
                "total": 220.00,
            },
        ],
        "rates": {"labor_per_hour": 110.00, "trip_charge": 75.00},
        "total": 590.00,
        "date": "2026-03-05",
    },
]
