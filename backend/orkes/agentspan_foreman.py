"""
Agentspan (Orkes Conductor) integration for ForemanAI.

Wraps the existing ForemanAI lifecycle in a durable Agentspan workflow.
This module is purely additive — it does not modify the existing pipeline.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from backend.models.work_order import WorkOrder, WorkOrderStatus
from backend.state.redis_client import _client as _redis_client
from backend.state.redis_client import get_work_order

logger = logging.getLogger(__name__)

AGENTSPAN_URL = os.getenv("AGENTSPAN_SERVER_URL", "http://localhost:6767")
_AGENTSPAN_MODEL = os.getenv(
    "AGENTSPAN_MODEL", "anthropic/claude-haiku-4-5-20251001"
)

# ── Availability ─────────────────────────────────────────────────────────


async def is_agentspan_available() -> bool:
    """Probe the Agentspan server. Returns False if unreachable."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{AGENTSPAN_URL}/health")
            return resp.status_code < 500
    except Exception:
        return False


# ── Agent definition (built once per process) ────────────────────────────

_runtime: Any = None
_agent: Any = None


def _build_agent():
    """Construct the Agentspan Agent. Called at most once per process."""
    from agentspan.agents import Agent, function_tool

    @function_tool
    def report_lifecycle_plan(work_order_id: str, raw_request: str) -> str:
        """Generate a structured lifecycle plan for the ForemanAI work order."""
        return (
            f"ForemanAI Durable Work Order\n"
            f"ID:      {work_order_id}\n"
            f"Request: {raw_request}\n\n"
            f"Lifecycle stages:\n"
            f"  1. create_work_order              [COMPLETE]\n"
            f"  2. run_intake                     [PENDING]\n"
            f"  3. wait_for_intake_approval       [CHECKPOINT]\n"
            f"  4. run_scheduling                 [PENDING]\n"
            f"  5. wait_for_scheduling_approval   [CHECKPOINT]\n"
            f"  6. run_invoicing                  [PENDING]\n"
            f"  7. wait_for_invoice_approval      [CHECKPOINT]\n"
            f"  8. complete                       [PENDING]\n\n"
            f"Current checkpoint: WAITING_FOR_INTAKE_APPROVAL\n"
            f"Awaiting human approval before each stage advances."
        )

    return Agent(
        name="foreman_durable_work_order_agent",
        model=_AGENTSPAN_MODEL,
        instructions=(
            "You are the ForemanAI work order lifecycle coordinator. "
            "When given a work order, call report_lifecycle_plan once with "
            "the work_order_id and raw_request. "
            "Then respond with exactly one sentence: "
            "'WorkOrder [ID] is initialized and WAITING_FOR_INTAKE_APPROVAL — "
            "human approval required before the pipeline advances.'"
        ),
        tools=[report_lifecycle_plan],
    )


def _build_runtime():
    """Construct the AgentRuntime pointed at the local Agentspan server."""
    from agentspan.agents import AgentRuntime
    from agentspan.agents.runtime.config import AgentConfig

    config = AgentConfig(
        server_url=f"{AGENTSPAN_URL}/api",
        auto_start_server=False,
        auto_start_workers=True,
        auto_register_integrations=True,
        log_level="WARNING",
    )
    return AgentRuntime(config=config)


async def _ensure_initialized() -> bool:
    """Lazily init the agent and runtime. Returns True if ready."""
    global _runtime, _agent
    if _runtime is not None:
        return True

    if not await is_agentspan_available():
        logger.warning("Agentspan server not reachable at %s", AGENTSPAN_URL)
        return False

    try:
        _agent = _build_agent()
        _runtime = _build_runtime()
        logger.info("Agentspan runtime initialized (server=%s)", AGENTSPAN_URL)
        return True
    except Exception as exc:
        logger.warning("Agentspan init failed: %s", exc)
        return False


# ── Public helpers ───────────────────────────────────────────────────────


async def start_foreman_workflow(raw_request: str, work_order_id: str) -> str | None:
    """
    Start a durable Agentspan workflow for a ForemanAI work order.

    Creates the execution on the Agentspan/Conductor server and stores
    the execution_id → work_order_id mapping in Redis.

    Returns the execution_id, or None if Agentspan is unavailable.
    """
    if not await _ensure_initialized():
        return None

    try:
        handle = await _runtime.start_async(
            _agent,
            f"work_order_id={work_order_id} raw_request={raw_request}",
        )
    except Exception as exc:
        logger.warning("Agentspan start_async failed: %s", exc)
        return None

    # Persist the bidirectional mapping so status lookups work later
    r = _redis_client()
    await r.set(f"agentspan_exec:{handle.execution_id}", work_order_id)
    await r.set(f"agentspan_wo:{work_order_id}", handle.execution_id)

    return handle.execution_id


async def get_workflow_status(execution_id: str) -> dict[str, Any] | None:
    """
    Return combined Agentspan + Redis status for an execution.

    Returns None if Agentspan is unavailable or the execution_id is unknown.
    """
    if not await _ensure_initialized():
        return None

    r = _redis_client()

    # Reverse-look up the work_order_id from the execution_id
    work_order_id = await r.get(f"agentspan_exec:{execution_id}")
    if not work_order_id:
        return None

    # WorkOrder state from Redis
    wo: WorkOrder | None = await get_work_order(work_order_id)

    # Agentspan execution state from Conductor
    agentspan_exec_status = "UNKNOWN"
    is_running = False
    current_task = None
    try:
        status = await _runtime.get_status_async(execution_id)
        agentspan_exec_status = status.status
        is_running = status.is_running
        current_task = status.current_task
    except Exception as exc:
        logger.warning("Agentspan get_status_async failed: %s", exc)

    checkpoint = _derive_checkpoint(wo)

    return {
        "execution_id": execution_id,
        "work_order_id": work_order_id,
        "agentspan_status": agentspan_exec_status,
        "is_running": is_running,
        "current_agentspan_task": current_task,
        "current_stage": wo.status if wo else "UNKNOWN",
        "waiting_for": checkpoint,
        "work_order": wo.model_dump() if wo else None,
    }


def _derive_checkpoint(wo: WorkOrder | None) -> str:
    if wo is None:
        return "UNKNOWN"
    if wo.status == WorkOrderStatus.complete:
        return "COMPLETE"
    if not wo.approvals.intake_approved:
        return "WAITING_FOR_INTAKE_APPROVAL"
    if not wo.approvals.scheduling_approved:
        return "WAITING_FOR_SCHEDULING_APPROVAL"
    if not wo.approvals.invoice_approved:
        return "WAITING_FOR_INVOICE_APPROVAL"
    return "COMPLETE"


async def shutdown() -> None:
    """Gracefully shut down the Agentspan runtime (call from app lifespan)."""
    global _runtime
    if _runtime is not None:
        try:
            await _runtime.shutdown_async()
        except Exception as exc:
            logger.warning("Agentspan shutdown error: %s", exc)
        _runtime = None
