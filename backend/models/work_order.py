from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class WorkOrderStatus(str, Enum):
    intake = "intake"
    scheduling = "scheduling"
    invoicing = "invoicing"
    complete = "complete"


class Classification(BaseModel):
    job_type: str
    entities: dict[str, Any] = Field(default_factory=dict)
    completeness_flags: list[str] = Field(default_factory=list)


class Schedule(BaseModel):
    proposed_times: list[str] = Field(default_factory=list)
    outreach_draft: dict[str, Any] = Field(default_factory=dict)
    parts_suggestion: list[dict[str, Any]] = Field(default_factory=list)


class Invoice(BaseModel):
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    rates: dict[str, Any] = Field(default_factory=dict)
    template_filled: str | None = None
    vendor_email_draft: str | None = None


class Approvals(BaseModel):
    intake_approved: bool = False
    scheduling_approved: bool = False
    invoice_approved: bool = False


class WorkOrder(BaseModel):
    id: str
    status: WorkOrderStatus = WorkOrderStatus.intake
    raw_request: str
    classification: Classification | None = None
    schedule: Schedule | None = None
    invoice: Invoice | None = None
    approvals: Approvals = Field(default_factory=Approvals)
    trace_id: str | None = None
