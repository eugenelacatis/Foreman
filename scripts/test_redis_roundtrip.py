"""Round-trip test: save a WorkOrder to Redis and load it back."""
from __future__ import annotations

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.models.work_order import WorkOrder, WorkOrderStatus
from backend.state.redis_client import close_redis, get_work_order, init_redis, save_work_order

TEST_ID = "test-001"
TEST_STATUS = WorkOrderStatus.intake  # closest valid value to "intake_pending"
TEST_RAW_REQUEST = "Fix the leaking pipe under the kitchen sink."


async def main() -> None:
    await init_redis()

    original = WorkOrder(
        id=TEST_ID,
        status=TEST_STATUS,
        raw_request=TEST_RAW_REQUEST,
    )

    await save_work_order(original)

    loaded = await get_work_order(TEST_ID)
    assert loaded is not None, "get_work_order returned None"
    assert loaded.id == original.id, f"id mismatch: {loaded.id!r} != {original.id!r}"
    assert loaded.status == original.status, f"status mismatch: {loaded.status!r} != {original.status!r}"
    assert loaded.raw_request == original.raw_request, (
        f"raw_request mismatch: {loaded.raw_request!r} != {original.raw_request!r}"
    )

    print("✅ Round-trip works")
    await close_redis()


if __name__ == "__main__":
    asyncio.run(main())
