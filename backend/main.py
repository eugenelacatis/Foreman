from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from backend.api.orkes_routes import orkes_router
from backend.api.routes import router
from backend.orkes.agentspan_foreman import shutdown as agentspan_shutdown
from backend.state.redis_client import close_redis, init_redis, _client

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[StarletteIntegration(), FastApiIntegration()],
    auto_enabling_integrations=False,
    traces_sample_rate=0.0,
    environment=os.getenv("ENV", "development"),
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_redis()
    await _client().ping()
    yield
    await agentspan_shutdown()
    await close_redis()


app = FastAPI(title="ForemanAI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(orkes_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
