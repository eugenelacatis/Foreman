from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, HTTPException

from backend.agents.armoriq_client import check_action
from backend.agents.invoicing_agent import run_invoicing as _run_invoicing
from backend.models.work_order import Approvals, Invoice, WorkOrder, WorkOrderStatus
from backend.orchestration.pipeline import advance_pipeline
from backend.state.invoice_history import search_invoice_history
from backend.state.redis_client import get_work_order, save_work_order

router = APIRouter()


@router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(raw_request: str = Body(..., embed=True)) -> WorkOrder:
    wo = WorkOrder(
        id=str(uuid.uuid4()),
        status=WorkOrderStatus.intake,
        raw_request=raw_request,
    )
    await save_work_order(wo)
    return wo


@router.get("/work-orders/{id}", response_model=WorkOrder)
async def get_work_order_route(id: str) -> WorkOrder:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return wo


@router.post("/work-orders/{id}/approve", response_model=WorkOrder)
async def approve_work_order(
    id: str,
    stage: str = Body(..., embed=True),
) -> WorkOrder:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")

    if stage == "intake":
        wo.approvals.intake_approved = True
        wo.status = WorkOrderStatus.scheduling
        await save_work_order(wo)
        return await advance_pipeline(wo.id, "scheduling") or wo
    elif stage == "scheduling":
        if not wo.approvals.intake_approved:
            raise HTTPException(
                status_code=422,
                detail="Intake must be approved before approving scheduling.",
            )

        wo.approvals.scheduling_approved = True
        wo.status = WorkOrderStatus.invoicing
        await save_work_order(wo)
        return await advance_pipeline(wo.id, "invoicing") or wo
    elif stage == "invoice":
        if not wo.approvals.scheduling_approved:
            raise HTTPException(
                status_code=422,
                detail="Scheduling must be approved before approving invoice.",
            )

        wo.approvals.invoice_approved = True
        wo.status = WorkOrderStatus.complete
        await save_work_order(wo)
        return wo
    else:
        raise HTTPException(status_code=400, detail="Invalid approval stage")

@router.post("/work-orders/{id}/demo-block")
async def demo_block(id: str) -> dict:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    result = await check_action("DEMO_BLOCK", "demo-plan-001")
    return {
        "allowed": False,
        "reason": result["reason"],
        "action": "commit_invoice_without_approval",
    }


@router.get("/work-orders/{id}/invoice-history")
async def invoice_history(id: str, query: str = "") -> list[dict]:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    search_query = query or (wo.raw_request if wo.raw_request else "")
    return await search_invoice_history(search_query)


@router.post("/work-orders/{id}/invoice-chat")
async def invoice_chat(
    id: str,
    message: str = Body(..., embed=True),
) -> dict:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")

    result = await _run_invoicing(wo.model_dump(), user_message=message)

    invoice_data = result.get("invoice", {})
    wo.invoice = Invoice(
        line_items=invoice_data.get("line_items", []),
        rates=invoice_data.get("rates", {}),
        template_filled=invoice_data.get("template_filled"),
        vendor_email_draft=invoice_data.get("vendor_email_draft"),
    )
    await save_work_order(wo)

    reply = result.get("question_for_user") or (
        "Invoice complete — ready for your approval."
        if result.get("status") == "COMPLETE"
        else f"Still need: {', '.join(result.get('missing_fields', []))}"
    )
    return {"reply": reply, "work_order": wo}
