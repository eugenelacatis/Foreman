from __future__ import annotations

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

    # After intake approval status becomes "scheduling" — run scheduling and stop.
    if wo.status == WorkOrderStatus.scheduling and wo.schedule is None:
        wo = await run_scheduling(wo)
        await save_work_order(wo)

    # After scheduling approval status becomes "invoicing" — invoicing is handled
    # interactively via /invoice-chat, nothing to auto-run here.
    # After invoice approval status is already "complete" — nothing to run.

    return wo
