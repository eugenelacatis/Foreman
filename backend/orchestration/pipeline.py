from __future__ import annotations

from fastapi import HTTPException

from backend.agents.intake_agent import run_intake as _intake
from backend.agents.scheduling_agent import run_scheduling as _scheduling
from backend.agents.invoicing_agent import run_invoicing as _invoicing
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
    wo.classification = Classification(**result)
    return wo


async def run_scheduling(wo: WorkOrder) -> WorkOrder:
    if wo.classification is None:
        wo.classification = Classification(
            job_type="HVAC repair",
            entities={
                "issue": "compressor grinding noise",
                "location": "142 Elm Street",
                "client": "Riverside Property Management",
                "urgency": "high",
            },
            completeness_flags=["FALLBACK_CLASSIFICATION"],
        )

    result = await _scheduling(wo.model_dump())

    outreach = result.get("outreach_draft", "")
    if isinstance(outreach, dict):
        outreach = outreach.get("message", str(outreach))

    wo.schedule = Schedule(
        proposed_times=result.get("proposed_times", []),
        outreach_draft=outreach,
        parts_suggestion=result.get("parts_suggestion", []),
    )
    return wo


async def run_invoicing(wo: WorkOrder, user_message: str | None = None) -> WorkOrder:
    if wo.classification is None:
        wo.classification = Classification(
            job_type="HVAC repair",
            entities={
                "issue": "compressor grinding noise",
                "location": "142 Elm Street",
                "client": "Riverside Property Management",
                "urgency": "high",
            },
            completeness_flags=["FALLBACK_CLASSIFICATION"],
        )

    result = await _invoicing(wo.model_dump(), user_message=user_message)
    invoice_data = result.get("invoice", {})
    wo.invoice = Invoice(
        line_items=invoice_data.get("line_items", []),
        rates=invoice_data.get("rates", {}),
        template_filled=invoice_data.get("template_filled"),
        vendor_email_draft=invoice_data.get("vendor_email_draft"),
    )
    return wo


async def advance_pipeline(work_order_id: str, stage: str) -> WorkOrder | None:
    wo = await get_work_order(work_order_id)
    if wo is None:
        return None

    if stage == "intake":
        wo = await run_intake(wo)
        wo.status = WorkOrderStatus.intake
        await save_work_order(wo)

    elif stage == "scheduling":
        if not wo.approvals.intake_approved:
            raise HTTPException(
                status_code=422,
                detail="Intake must be approved before advancing to scheduling.",
            )
        wo.status = WorkOrderStatus.scheduling
        wo = await run_scheduling(wo)
        await save_work_order(wo)

    elif stage == "invoicing":
        if not wo.approvals.scheduling_approved:
            raise HTTPException(
                status_code=422,
                detail="Scheduling must be approved before advancing to invoicing.",
            )
        wo.status = WorkOrderStatus.invoicing
        wo = await run_invoicing(wo)
        await save_work_order(wo)

    return wo
