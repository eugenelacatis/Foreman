"""Live local parts pricing via Browserbase (optional bolt-on).

Browserbase runs a real cloud browser we drive with Playwright to look up a
live retail price for a part, instead of relying solely on the agent's estimate.

This is a Path-B feature: it degrades gracefully. If Browserbase is not
configured, the SDK/Playwright aren't installed, the network is down, or a
price can't be parsed, every function returns ``None`` / ``{}`` and the caller
falls back to the agent's estimated price. A failed lookup must never raise.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import statistics
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

# Google Shopping is a generic source that works for arbitrary part names.
# Override via env to point at a specific supplier if desired.
_SEARCH_URL = os.getenv(
    "BROWSERBASE_SEARCH_URL",
    "https://www.google.com/search?tbm=shop&hl=en&gl=us&q={query}",
)

# Plausible price band for a single trade part — discard everything outside it
# so we never pick up SKUs, phone numbers, or $0.00 placeholders.
_MIN_PRICE = 1.0
_MAX_PRICE = 5000.0

_PRICE_RE = re.compile(r"\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))")
_PER_PART_TIMEOUT_S = 20.0
_TOTAL_TIMEOUT_S = 75.0


def is_configured() -> bool:
    """True when Browserbase credentials are present."""
    return bool(os.getenv("BROWSERBASE_API_KEY") and os.getenv("BROWSERBASE_PROJECT_ID"))


def _parse_price(html: str) -> float | None:
    """Pull a representative price out of a shopping results page.

    Takes the median of the in-band prices found, which is robust against the
    occasional accessory/outlier listing.
    """
    prices: list[float] = []
    for raw in _PRICE_RE.findall(html):
        try:
            val = float(raw.replace(",", ""))
        except ValueError:
            continue
        if _MIN_PRICE <= val <= _MAX_PRICE:
            prices.append(val)
    if not prices:
        return None
    return round(statistics.median(prices), 2)


async def _create_session_connect_url() -> str | None:
    """Create a Browserbase session and return its CDP connect URL, or None."""
    try:
        from browserbase import Browserbase  # lazy: optional dependency
    except Exception as e:
        logger.warning("Browserbase SDK not installed: %s", e)
        return None
    try:
        bb = Browserbase(api_key=os.environ["BROWSERBASE_API_KEY"])
        # The SDK call is synchronous HTTP; don't block the event loop.
        session = await asyncio.to_thread(
            bb.sessions.create, project_id=os.environ["BROWSERBASE_PROJECT_ID"]
        )
        return session.connect_url
    except Exception as e:
        logger.warning("Browserbase session create failed: %s", e)
        return None


async def get_live_prices(
    part_names: list[str], near: str | None = None
) -> dict[str, float]:
    """Look up a live price for each part name, reusing one browser session.

    Returns ``{name: price}`` only for the parts that resolved; an empty dict on
    any failure. Never raises — the caller falls back to estimates.
    """
    if not part_names or not is_configured():
        return {}

    try:
        return await asyncio.wait_for(
            _get_live_prices_inner(part_names, near), timeout=_TOTAL_TIMEOUT_S
        )
    except Exception as e:  # timeout or anything else — degrade silently
        logger.warning("get_live_prices failed, falling back to estimates: %s", e)
        return {}


async def _get_live_prices_inner(
    part_names: list[str], near: str | None
) -> dict[str, float]:
    try:
        from playwright.async_api import async_playwright  # lazy: optional dependency
    except Exception as e:
        logger.warning("Playwright not installed: %s", e)
        return {}

    connect_url = await _create_session_connect_url()
    if not connect_url:
        return {}

    out: dict[str, float] = {}
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(connect_url)
        try:
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()
            for name in part_names:
                query = f"{name} {near}" if near else name
                url = _SEARCH_URL.format(query=quote_plus(query))
                try:
                    await page.goto(
                        url, wait_until="domcontentloaded", timeout=_PER_PART_TIMEOUT_S * 1000
                    )
                    html = await page.content()
                    price = _parse_price(html)
                    if price is not None:
                        out[name] = price
                        logger.info("Browserbase live price: %s -> $%.2f", name, price)
                except Exception as e:
                    logger.warning("live price lookup failed for %r: %s", name, e)
        finally:
            await browser.close()
    return out
