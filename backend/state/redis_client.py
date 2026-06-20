from __future__ import annotations

import json
import os
from typing import AsyncGenerator

import redis.asyncio as aioredis

from backend.models.work_order import WorkOrder

_redis: aioredis.Redis | None = None


def _get_url() -> str:
    return os.environ.get("REDIS_URL", "redis://localhost:6379")


async def init_redis() -> None:
    global _redis
    _redis = aioredis.from_url(_get_url(), decode_responses=True)


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


def _client() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialised — call init_redis() at startup")
    return _redis


async def get_work_order(id: str) -> WorkOrder | None:
    raw = await _client().get(f"wo:{id}")
    if raw is None:
        return None
    return WorkOrder.model_validate_json(raw)


async def save_work_order(wo: WorkOrder) -> None:
    await _client().set(f"wo:{wo.id}", wo.model_dump_json())


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    yield _client()
