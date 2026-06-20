from __future__ import annotations

import asyncio
import json
import logging
import os
from functools import lru_cache

logger = logging.getLogger(__name__)

SEEDED_INVOICES: list[dict] = [
    # ── HVAC ──────────────────────────────────────────────────────────────
    {
        "id": "inv-001",
        "job_type": "HVAC repair",
        "line_items": [
            {"description": "Refrigerant recharge R-410A (2 lbs)", "qty": 2, "unit_price": 85.00},
            {"description": "Capacitor replacement", "qty": 1, "unit_price": 45.00},
            {"description": "Labor — diagnostic and repair (2.5 hrs)", "qty": 2.5, "unit_price": 95.00},
        ],
        "total": 517.50,
        "notes": "Residential split system stopped cooling, R-410A recharge",
    },
    {
        "id": "inv-002",
        "job_type": "HVAC compressor replacement",
        "line_items": [
            {"description": "Compressor unit (3-ton)", "qty": 1, "unit_price": 1100.00},
            {"description": "Refrigerant recharge R-410A (3 lbs)", "qty": 3, "unit_price": 85.00},
            {"description": "Labor — compressor R&R (6 hrs)", "qty": 6, "unit_price": 105.00},
        ],
        "total": 1985.00,
        "notes": "Compressor seized, grinding noise on startup, full replacement",
    },
    {
        "id": "inv-003",
        "job_type": "HVAC annual maintenance",
        "line_items": [
            {"description": "Filter replacement MERV-13 (qty 4)", "qty": 4, "unit_price": 22.00},
            {"description": "Evaporator coil cleaning", "qty": 1, "unit_price": 120.00},
            {"description": "Labor — PM inspection (1.5 hrs)", "qty": 1.5, "unit_price": 95.00},
        ],
        "total": 380.50,
        "notes": "Seasonal tune-up, commercial RTU, both units serviced",
    },
    {
        "id": "inv-004",
        "job_type": "HVAC thermostat and controls repair",
        "line_items": [
            {"description": "Smart thermostat (Ecobee)", "qty": 1, "unit_price": 189.00},
            {"description": "Control board diagnostic", "qty": 1, "unit_price": 75.00},
            {"description": "Labor — install and calibration (1.5 hrs)", "qty": 1.5, "unit_price": 95.00},
        ],
        "total": 406.50,
        "notes": "Thermostat not responding, replaced and recalibrated HVAC controls",
    },
    {
        "id": "inv-005",
        "job_type": "furnace repair",
        "line_items": [
            {"description": "Igniter replacement", "qty": 1, "unit_price": 65.00},
            {"description": "Heat exchanger inspection", "qty": 1, "unit_price": 95.00},
            {"description": "Labor — furnace diagnostic and repair (2 hrs)", "qty": 2, "unit_price": 95.00},
        ],
        "total": 350.00,
        "notes": "Furnace not igniting, cracked igniter replaced, no heat",
    },
    # ── Plumbing ───────────────────────────────────────────────────────────
    {
        "id": "inv-006",
        "job_type": "water heater replacement",
        "line_items": [
            {"description": "Water heater 40-gal gas (Rheem)", "qty": 1, "unit_price": 620.00},
            {"description": "Labor — removal and install (3 hrs)", "qty": 3, "unit_price": 110.00},
            {"description": "Permit fee", "qty": 1, "unit_price": 75.00},
        ],
        "total": 1025.00,
        "notes": "Water heater failed, no hot water, gas unit replaced",
    },
    {
        "id": "inv-007",
        "job_type": "water heater repair",
        "line_items": [
            {"description": "Thermocouple replacement", "qty": 1, "unit_price": 35.00},
            {"description": "Anode rod replacement", "qty": 1, "unit_price": 45.00},
            {"description": "Labor — water heater service (1.5 hrs)", "qty": 1.5, "unit_price": 110.00},
        ],
        "total": 245.00,
        "notes": "Pilot not staying lit on water heater, thermocouple and anode rod replaced",
    },
    {
        "id": "inv-008",
        "job_type": "plumbing leak repair",
        "line_items": [
            {"description": "Copper pipe section (10 ft)", "qty": 1, "unit_price": 45.00},
            {"description": "Solder fittings", "qty": 4, "unit_price": 8.00},
            {"description": "Labor — pipe repair (1.5 hrs)", "qty": 1.5, "unit_price": 95.00},
        ],
        "total": 319.50,
        "notes": "Pinhole leak under kitchen sink, replaced 10-ft copper run",
    },
    {
        "id": "inv-009",
        "job_type": "drain cleaning",
        "line_items": [
            {"description": "Hydro-jetting service", "qty": 1, "unit_price": 275.00},
            {"description": "Camera inspection", "qty": 1, "unit_price": 150.00},
            {"description": "Labor (2 hrs)", "qty": 2, "unit_price": 95.00},
        ],
        "total": 615.00,
        "notes": "Slow drain throughout building, main line blockage cleared",
    },
    {
        "id": "inv-010",
        "job_type": "backflow preventer and valve replacement",
        "line_items": [
            {"description": "Backflow preventer (1-inch)", "qty": 1, "unit_price": 185.00},
            {"description": "Shut-off valve replacement", "qty": 2, "unit_price": 55.00},
            {"description": "Labor — valve work (2 hrs)", "qty": 2, "unit_price": 110.00},
        ],
        "total": 515.00,
        "notes": "Annual backflow test failed, preventer and isolation valves replaced",
    },
    # ── Electrical ─────────────────────────────────────────────────────────
    {
        "id": "inv-011",
        "job_type": "electrical panel upgrade",
        "line_items": [
            {"description": "200A main panel install", "qty": 1, "unit_price": 1200.00},
            {"description": "Whole-home surge protector", "qty": 1, "unit_price": 175.00},
            {"description": "Labor (6 hrs)", "qty": 6, "unit_price": 110.00},
            {"description": "Permit fee", "qty": 1, "unit_price": 85.00},
        ],
        "total": 2120.00,
        "notes": "Code upgrade from 100A to 200A panel, added surge protection",
    },
    {
        "id": "inv-012",
        "job_type": "electrical outlet and circuit repair",
        "line_items": [
            {"description": "GFCI outlet replacement (qty 6)", "qty": 6, "unit_price": 28.00},
            {"description": "Breaker replacement (20A)", "qty": 2, "unit_price": 45.00},
            {"description": "Labor — electrical repair (2.5 hrs)", "qty": 2.5, "unit_price": 110.00},
        ],
        "total": 533.00,
        "notes": "Tripping breakers, replaced GFCI outlets and faulty breakers",
    },
    {
        "id": "inv-013",
        "job_type": "lighting fixture installation",
        "line_items": [
            {"description": "LED recessed light fixture (qty 12)", "qty": 12, "unit_price": 55.00},
            {"description": "Dimmer switch (qty 3)", "qty": 3, "unit_price": 35.00},
            {"description": "Labor — electrical install (4 hrs)", "qty": 4, "unit_price": 110.00},
        ],
        "total": 1205.00,
        "notes": "Lighting upgrade, recessed LEDs replacing fluorescent, dimmers added",
    },
    # ── General ────────────────────────────────────────────────────────────
    {
        "id": "inv-014",
        "job_type": "drywall patch",
        "line_items": [
            {"description": "Drywall sheet (4x8)", "qty": 1, "unit_price": 22.00},
            {"description": "Joint compound and tape", "qty": 1, "unit_price": 18.00},
            {"description": "Labor (3 hrs)", "qty": 3, "unit_price": 75.00},
        ],
        "total": 265.00,
        "notes": "Water-damaged ceiling patch after plumbing leak, two coats, primed",
    },
    {
        "id": "inv-015",
        "job_type": "emergency pipe burst repair",
        "line_items": [
            {"description": "PEX pipe replacement (25 ft)", "qty": 25, "unit_price": 4.50},
            {"description": "Push-fit fittings", "qty": 6, "unit_price": 12.00},
            {"description": "Water extraction service", "qty": 1, "unit_price": 350.00},
            {"description": "Labor — emergency repair (4 hrs)", "qty": 4, "unit_price": 130.00},
        ],
        "total": 1084.50,
        "notes": "Burst pipe in crawl space, emergency call-out, water damage mitigated",
    },
]

# ── Vector search ─────────────────────────────────────────────────────────────

_INDEX_NAME = "invoice_idx"
_KEY_PREFIX = "invoice:"
_DIM = 384  # all-MiniLM-L6-v2


def _invoice_text(inv: dict) -> str:
    lines = " ".join(li.get("description", "") for li in inv.get("line_items", []))
    return f"{inv.get('job_type', '')} {inv.get('notes', '')} {lines}"


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def _embed(text: str) -> bytes:
    import numpy as np
    vec = _model().encode(text, normalize_embeddings=True)
    return vec.astype(np.float32).tobytes()


def _redis_client():
    import redis
    url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    return redis.from_url(url, decode_responses=False)


def _ensure_index(r) -> None:
    from redis.commands.search.field import TextField, VectorField
    from redis.commands.search.indexDefinition import IndexDefinition, IndexType

    try:
        r.ft(_INDEX_NAME).info()
        return  # index already exists with data
    except Exception:
        pass

    try:
        r.ft(_INDEX_NAME).create_index(
            (
                TextField("job_type"),
                TextField("notes"),
                VectorField(
                    "embedding",
                    "FLAT",
                    {"TYPE": "FLOAT32", "DIM": _DIM, "DISTANCE_METRIC": "COSINE"},
                ),
            ),
            definition=IndexDefinition(prefix=[_KEY_PREFIX], index_type=IndexType.HASH),
        )
    except Exception as exc:
        if "Index already exists" not in str(exc):
            raise

    pipe = r.pipeline(transaction=False)
    for inv in SEEDED_INVOICES:
        pipe.hset(
            f"{_KEY_PREFIX}{inv['id']}",
            mapping={
                "id": inv["id"],
                "job_type": inv.get("job_type", ""),
                "notes": inv.get("notes", ""),
                "json_data": json.dumps(inv),
                "embedding": _embed(_invoice_text(inv)),
            },
        )
    pipe.execute()


def _vector_search_sync(query: str, top_k: int) -> list[dict]:
    from redis.commands.search.query import Query

    r = _redis_client()
    _ensure_index(r)

    q = (
        Query(f"*=>[KNN {top_k} @embedding $vec AS score]")
        .sort_by("score")
        .return_fields("json_data", "score")
        .paging(0, top_k)
        .dialect(2)
    )
    results = r.ft(_INDEX_NAME).search(q, query_params={"vec": _embed(query)})
    return [json.loads(doc.json_data) for doc in results.docs]


# ── Keyword fallback (original logic) ────────────────────────────────────────

def _keyword_search(query: str, top_k: int) -> list[dict]:
    terms = query.lower().split()
    scored: list[tuple[int, dict]] = []
    for inv in SEEDED_INVOICES:
        line_text = " ".join(
            li.get("description", "") for li in inv.get("line_items", [])
        )
        haystack = (
            inv.get("job_type", "") + " " + inv.get("notes", "") + " " + line_text
        ).lower()
        score = sum(1 for t in terms if t in haystack)
        if score == 0:
            continue
        scored.append((score, inv))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [inv for _, inv in scored[:top_k]]


# ── Public interface ──────────────────────────────────────────────────────────

async def search_invoice_history(query: str, top_k: int = 3) -> list[dict]:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _vector_search_sync, query, top_k)
    except Exception as exc:
        logger.warning("Vector search failed, falling back to keyword search: %s", exc)
        return _keyword_search(query, top_k)


if __name__ == "__main__":
    async def _main() -> None:
        for query in ["water heater repair", "HVAC compressor", "electrical panel"]:
            print(f"\n{'─' * 60}")
            print(f"  Query: {query!r}")
            print(f"{'─' * 60}")
            results = await search_invoice_history(query)
            if not results:
                print("  (no results)")
            for r in results:
                print(f"  [{r['id']}] {r['job_type']}  total=${r['total']:.2f}")
                print(f"        {r['notes']}")
            assert len(results) >= 2, f"Expected ≥2 results for {query!r}, got {len(results)}"
        print("\n✅ search_invoice_history returns ≥2 relevant results for all test queries")

    asyncio.run(_main())
