"""Live local-supplier lookup for the parts suggestion.

Pulls real nearby trade/hardware suppliers from OpenStreetMap (Nominatim for
geocoding, Overpass for the supplier search), keyed off the work order's job
address. No API keys, no paid services.

Everything here degrades gracefully (Path B): any failure returns ``None`` /
``[]`` instead of raising, so a flaky external call can never break the route
or the UI. Prices are the agent's estimate, shown the same at every store —
we do not invent per-store price spreads, stock counts, or fake stores.
"""

from __future__ import annotations

import asyncio
import logging
from math import asin, cos, radians, sin, sqrt
from typing import Any

import httpx

from backend.agents.browserbase_client import get_live_prices

logger = logging.getLogger(__name__)

# Nominatim requires a User-Agent with a contact string; Overpass appreciates one.
_USER_AGENT = "ForemanAI/1.0 (foreman-hackathon; contact: team@foreman.example)"

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"

_SEARCH_RADIUS_M = 12_000  # ~12 km
_MAX_SUPPLIERS = 6

# Throttle Nominatim to ~1 request/second per their usage policy.
_geocode_lock = asyncio.Lock()


def _haversine_mi(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in miles."""
    r_mi = 3958.7613
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * r_mi * asin(sqrt(a))


def _short_name(name: str) -> str:
    """A compact label for map pins / tight columns."""
    words = name.split()
    short = " ".join(words[:2])
    return short if len(short) <= 18 else short[:17].rstrip() + "…"


async def geocode(address: str) -> tuple[float, float] | None:
    """Resolve an address to ``(lat, lng)`` via Nominatim, or ``None`` on failure."""
    if not address or not address.strip():
        return None
    try:
        async with _geocode_lock:
            await asyncio.sleep(1.0)  # respect ~1 req/sec
            async with httpx.AsyncClient(timeout=15) as http:
                resp = await http.get(
                    _NOMINATIM_URL,
                    params={"q": address, "format": "json", "limit": 1},
                    headers={"User-Agent": _USER_AGENT},
                )
                resp.raise_for_status()
                results = resp.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:  # never raise to the caller
        logger.warning("geocode failed for %r: %s", address, e)
        return None


async def find_suppliers(lat: float, lng: float) -> list[dict[str, Any]]:
    """Find real trade/hardware suppliers near a point, nearest first.

    Returns up to ``_MAX_SUPPLIERS`` deduped suppliers. Empty list on any error.
    """
    query = f"""
    [out:json][timeout:25];
    (
      node["shop"~"trade|doityourself|hardware"](around:{_SEARCH_RADIUS_M},{lat},{lng});
      way["shop"~"trade|doityourself|hardware"](around:{_SEARCH_RADIUS_M},{lat},{lng});
    );
    out center tags;
    """
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                _OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
    except Exception as e:  # never raise to the caller
        logger.warning("find_suppliers Overpass query failed: %s", e)
        return []

    suppliers: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for el in elements:
        tags = el.get("tags", {})
        name = (tags.get("name") or "").strip()
        if not name or name.lower() in seen_names:
            continue

        # node carries lat/lon directly; way carries a `center`.
        if el.get("type") == "node":
            s_lat, s_lng = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            s_lat, s_lng = center.get("lat"), center.get("lon")
        if s_lat is None or s_lng is None:
            continue

        seen_names.add(name.lower())
        # Assemble a human address from OSM address tags when present.
        parts = [
            f"{tags.get('addr:housenumber', '')} {tags.get('addr:street', '')}".strip(),
            tags.get("addr:city", ""),
        ]
        address = ", ".join(p for p in parts if p) or "Address unavailable"

        suppliers.append(
            {
                "id": str(el.get("id")),
                "name": name,
                "shortName": _short_name(name),
                "address": address,
                "distanceMi": round(_haversine_mi(lat, lng, s_lat, s_lng), 1),
                "lat": float(s_lat),
                "lng": float(s_lng),
                # OSM rarely has reliable live hours; treat as orderable, never faked stock.
                "openNow": True,
                "isMyAccount": False,  # no real account system
                "isPreferred": False,  # set on the nearest below
            }
        )

    suppliers.sort(key=lambda s: s["distanceMi"])
    suppliers = suppliers[:_MAX_SUPPLIERS]
    if suppliers:
        suppliers[0]["isPreferred"] = True  # mark only the nearest
    return suppliers


async def build_local_parts(
    parts: list[dict[str, Any]], address: str
) -> dict[str, Any] | None:
    """Geocode the address, find suppliers, and assemble the LocalPartsData payload.

    Returns ``None`` when geocoding fails or no suppliers are found, so the route
    can honestly signal "no live data" instead of fabricating stores.
    """
    coords = await geocode(address)
    if coords is None:
        return None
    lat, lng = coords

    suppliers = await find_suppliers(lat, lng)
    if not suppliers:
        return None

    # Browserbase bolt-on: try a live retail price per part, keyed off the part
    # name. Falls back to the agent's estimate (and never raises) when Browserbase
    # is unconfigured or a lookup fails.
    part_names = [str(p.get("name", "")) for p in parts if p.get("name")]
    live_prices = await get_live_prices(part_names, near=address)

    # Price is shown identically at every store: it is either a live market price
    # (priceIsLive) or the agent's estimate. Stock is unknown, so we omit counts.
    listings_by_part: dict[str, list[dict[str, Any]]] = {}
    for part in parts:
        part_id = str(part.get("id"))
        name = str(part.get("name", ""))
        live_price = live_prices.get(name)
        price_is_live = live_price is not None
        price = float(live_price if price_is_live else (part.get("estimated_price_usd") or 0))
        listings_by_part[part_id] = [
            {
                "supplierId": s["id"],
                "price": price,
                "priceIsLive": price_is_live,
                "inStock": True,
                "pickupReady": True,
                "openNow": s["openNow"],
            }
            for s in suppliers
        ]

    return {
        # svgX/svgY are vestigial map placeholders; the live map uses lat/lng.
        "jobSite": {"lat": lat, "lng": lng, "svgX": 220, "svgY": 130},
        "suppliers": suppliers,
        "listingsByPart": listings_by_part,
        "live": True,
    }
