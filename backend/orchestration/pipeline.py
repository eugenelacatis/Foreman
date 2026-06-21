from __future__ import annotations

from fastapi import HTTPException

from backend.agents.intake_agent import run_intake as _intake
from backend.agents.invoicing_agent import run_invoicing as _invoicing
from backend.agents.scheduling_agent import run_scheduling as _scheduling
from backend.models.work_order import (
    Classification,
    Invoice,
    Schedule,
    WorkOrder,
    WorkOrderStatus,
)
from backend.state.redis_client import get_work_order, save_work_order


async def run_intake(wo: WorkOrder) -> WorkOrder:
    result = await _intake(wo.model_dump())
    wo.classification = Classification(
        **{k: v for k, v in result.items() if k != "trace_id"}
    )
    wo.trace_id = result.get("trace_id")
    return wo


async def run_scheduling(wo: WorkOrder) -> WorkOrder:
    result = await _scheduling(wo.model_dump())
    wo.schedule = Schedule(**{k: v for k, v in result.items() if k != "trace_id"})
    wo.trace_id = result.get("trace_id")
    return wo


async def run_invoicing(wo: WorkOrder, user_message: str | None = None) -> WorkOrder:
    result = await _invoicing(wo.model_dump(), user_message=user_message)
    invoice_data = result.get("invoice", {})
    wo.invoice = Invoice(
        line_items=invoice_data.get("line_items", []),
        rates=invoice_data.get("rates", {}),
        template_filled=invoice_data.get("template_filled"),
        vendor_email_draft=invoice_data.get("vendor_email_draft"),
    )
    wo.trace_id = result.get("trace_id")
    return wo


async def advance_pipeline(work_order_id: str) -> WorkOrder | None:
    wo = await get_work_order(work_order_id)
    if wo is None:
        return None

    if wo.classification is None:
        if not wo.approvals.intake_approved:
            raise HTTPException(
                422, "Intake must be approved before advancing to scheduling."
            )
        wo = await run_intake(wo)
        await save_work_order(wo)
        return wo

    if wo.schedule is None:
        if not wo.approvals.scheduling_approved:
            raise HTTPException(
                422, "Scheduling must be approved before advancing to invoicing."
            )
        wo = await run_scheduling(wo)
        await save_work_order(wo)
        return wo

    if not wo.approvals.invoice_approved:
        return wo

    if wo.invoice is None:
        wo = await run_invoicing(wo)
        wo.status = WorkOrderStatus.complete
        await save_work_order(wo)

    return wo
