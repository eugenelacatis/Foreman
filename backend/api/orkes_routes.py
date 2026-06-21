"""
Orkes Agentspan routes — additive endpoints that layer durable workflow
tracking on top of the existing ForemanAI pipeline.

Existing /work-orders endpoints are NOT touched here.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, HTTPException

from backend.models.work_order import Approvals, WorkOrder, WorkOrderStatus
from backend.orchestration.pipeline import advance_pipeline
from backend.orkes.agentspan_foreman import (
    AGENTSPAN_URL,
    get_workflow_status,
    is_agentspan_available,
    start_foreman_workflow,
)
from backend.state.redis_client import get_work_order, save_work_order

orkes_router = APIRouter(prefix="/orkes/agentspan")


@orkes_router.post("/work-orders")
async def create_agentspan_work_order(
    raw_request: str = Body(..., embed=True),
) -> dict:
    """
    Start a durable Agentspan-tracked lifecycle for a new work order.

    Creates the WorkOrder in Redis (same schema as /work-orders) and
    registers a Conductor workflow execution via the Agentspan server.

    Returns execution_id and work_order_id.  The human-approval gates
    still operate through the existing /work-orders/{id}/approve endpoint.
    """
    if not await is_agentspan_available():
        raise HTTPException(
            status_code=503,
            detail=f"Agentspan server is not available at {AGENTSPAN_URL}",
        )

    # Create the work order in Redis (same model as existing pipeline)
    wo = WorkOrder(
        id=str(uuid.uuid4()),
        status=WorkOrderStatus.intake,
        raw_request=raw_request,
        approvals=Approvals(),
    )
    await save_work_order(wo)

    # Start the Agentspan durable workflow
    execution_id = await start_foreman_workflow(raw_request, wo.id)
    if execution_id is None:
        raise HTTPException(
            status_code=503,
            detail=f"Agentspan server is not available at {AGENTSPAN_URL}",
        )

    return {
        "execution_id": execution_id,
        "work_order_id": wo.id,
        "status": "started",
        "current_stage": "create_work_order",
        "waiting_for": "WAITING_FOR_INTAKE_APPROVAL",
        "agentspan_url": AGENTSPAN_URL,
    }


@orkes_router.post("/work-orders/{work_order_id}/approve")
async def approve_agentspan_work_order(
    work_order_id: str,
    stage: str = Body(..., embed=True),
) -> dict:
    """
    Approve a lifecycle stage for an Agentspan-tracked work order.

    Mirrors the approval logic of /work-orders/{id}/approve and advances
    the pipeline, but returns the Agentspan response shape with
    current_stage and waiting_for instead of a bare WorkOrder.
    """
    wo = await get_work_order(work_order_id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")

    if stage == "intake":
        wo.approvals.intake_approved = True
        wo.status = WorkOrderStatus.scheduling
    elif stage == "scheduling":
        wo.approvals.scheduling_approved = True
        wo.status = WorkOrderStatus.invoicing
    elif stage == "invoice":
        wo.approvals.invoice_approved = True
        wo.status = WorkOrderStatus.complete
    else:
        raise HTTPException(status_code=400, detail=f"Unknown stage: {stage!r}")

    await save_work_order(wo)
    advanced = await advance_pipeline(work_order_id)
    wo = advanced if advanced is not None else wo

    waiting_for = _checkpoint(wo)
    return {
        "work_order": wo.model_dump(),
        "current_stage": wo.status,
        "waiting_for": waiting_for,
        "status": "complete" if wo.status == WorkOrderStatus.complete else "approved",
    }


def _checkpoint(wo: WorkOrder) -> str | None:
    """Derive the next human-approval checkpoint from work order state."""
    if wo.status == WorkOrderStatus.complete:
        return None
    if not wo.approvals.intake_approved:
        return "WAITING_FOR_INTAKE_APPROVAL"
    if not wo.approvals.scheduling_approved:
        return "WAITING_FOR_SCHEDULING_APPROVAL"
    if not wo.approvals.invoice_approved:
        return "WAITING_FOR_INVOICE_APPROVAL"
    return None


@orkes_router.get("/status/{execution_id}")
async def get_agentspan_status(execution_id: str) -> dict:
    """
    Return the combined Agentspan execution status + Redis work order state.

    Useful for polling the lifecycle stage from any client without needing
    direct access to the Agentspan/Conductor UI.
    """
    if not await is_agentspan_available():
        raise HTTPException(
            status_code=503,
            detail=f"Agentspan server is not available at {AGENTSPAN_URL}",
        )

    status = await get_workflow_status(execution_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=f"Execution {execution_id!r} not found",
        )

    return status
