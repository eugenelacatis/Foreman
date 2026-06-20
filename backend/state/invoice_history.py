from __future__ import annotations

from backend.seeds.invoice_history import INVOICE_HISTORY


async def search_invoice_history(query: str, top_k: int = 3) -> list[dict]:
    # TODO: replace with real vector search via Redis VSS (redis-py Search / FT.SEARCH)
    terms = query.lower().split()
    scored: list[tuple[int, dict]] = []
    for inv in INVOICE_HISTORY:
        haystack = (
            inv.get("vendor_name", "")
            + " "
            + inv.get("job_type", "")
            + " "
            + " ".join(
                item.get("description", "") for item in inv.get("line_items", [])
            )
        ).lower()
        score = sum(1 for t in terms if t in haystack)
        scored.append((score, inv))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [inv for _, inv in scored[:top_k]]
