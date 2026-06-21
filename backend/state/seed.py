from __future__ import annotations

import logging

from backend.models.work_order import (
    Approvals,
    Classification,
    Schedule,
    WorkOrder,
    WorkOrderStatus,
)
from backend.state.redis_client import get_work_order, save_work_order

logger = logging.getLogger(__name__)

_MAPLEWOOD = WorkOrder(
    id="maplewood",
    status=WorkOrderStatus.invoicing,
    raw_request=(
        "Repair the HVAC unit at 142 Elm Street. The compressor is making a grinding noise "
        "and the system stopped cooling yesterday. Client: Riverside Property Management. Urgency: high."
    ),
    classification=Classification(
        job_type="HVAC repair",
        entities={
            "location": "142 Elm Street",
            "client": "Riverside Property Management",
            "urgency": "high",
            "asset": "HVAC compressor",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Tue · 9:00 AM", "Wed · 11:00 AM", "Thu · 2:00 PM"],
        outreach_draft={
            "subject": "Service appointment — HVAC repair at 142 Elm Street",
            "body": (
                "Hi,\n\nWe've received your request for HVAC repair at 142 Elm Street. "
                "We can have a technician on site Tuesday at 9:00 AM, Wednesday at 11:00 AM, "
                "or Thursday at 2:00 PM. Please let us know which works best.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[
            {"name": "Compressor capacitor", "qty": 1, "price": 28.50},
            {"name": "Contactor", "qty": 1, "price": 18.50},
            {"name": "Refrigerant R-410A", "qty": 2, "price": 22.50},
        ],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=True,
        invoice_approved=False,
    ),
)

_DELGADO = WorkOrder(
    id="delgado",
    status=WorkOrderStatus.intake,
    raw_request=(
        "Electrical panel upgrade needed at Delgado Electric back office, 88 Commerce Ave. "
        "Current 100A panel is overloaded — need upgrade to 200A. Client: Delgado Electric. "
        "Urgency: normal."
    ),
    classification=None,
    approvals=Approvals(
        intake_approved=False,
        scheduling_approved=False,
        invoice_approved=False,
    ),
)


_WO_1041 = WorkOrder(
    id="wo-1041",
    status=WorkOrderStatus.invoicing,
    raw_request=(
        "AC unit replacement needed on the 2nd floor at Maplewood HVAC facility. "
        "Old unit failed — full replacement required. Client: Maplewood HVAC. Urgency: high."
    ),
    classification=Classification(
        job_type="AC unit replacement",
        entities={
            "location": "2nd floor",
            "client": "Maplewood HVAC",
            "urgency": "high",
            "asset": "AC unit",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Mon · 8:00 AM", "Tue · 10:00 AM", "Wed · 1:00 PM"],
        outreach_draft={
            "subject": "Service appointment — AC unit replacement",
            "body": (
                "Hi,\n\nWe've received your request for AC unit replacement on the 2nd floor. "
                "We can have a technician on site Monday at 8:00 AM, Tuesday at 10:00 AM, "
                "or Wednesday at 1:00 PM. Please let us know which works best.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[
            {"name": "AC condenser unit (3-ton)", "qty": 1, "price": 780.00},
            {"name": "Refrigerant R-410A", "qty": 3, "price": 22.50},
            {"name": "Thermostat (programmable)", "qty": 1, "price": 85.00},
        ],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=True,
        invoice_approved=False,
    ),
)

_WO_1040 = WorkOrder(
    id="wo-1040",
    status=WorkOrderStatus.scheduling,
    raw_request=(
        "Quarterly maintenance walkthrough for Riverside Property portfolio. "
        "Inspect all common areas, HVAC filters, lighting, and exterior. "
        "Client: Riverside Property Management. Urgency: normal."
    ),
    classification=Classification(
        job_type="Quarterly maintenance inspection",
        entities={
            "client": "Riverside Property",
            "urgency": "normal",
            "scope": "common areas, HVAC, lighting, exterior",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Thu · 9:00 AM", "Fri · 11:00 AM"],
        outreach_draft={
            "subject": "Quarterly maintenance walkthrough — Riverside Property",
            "body": (
                "Hi,\n\nWe're ready to schedule your quarterly maintenance walkthrough. "
                "We have availability Thursday at 9:00 AM or Friday at 11:00 AM. "
                "Please confirm which works for your team.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[
            {"name": "HVAC filters (16x20x1)", "qty": 6, "price": 8.50},
            {"name": "LED bulbs (A19)", "qty": 12, "price": 4.25},
        ],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=False,
        invoice_approved=False,
    ),
)

_WO_1039 = WorkOrder(
    id="wo-1039",
    status=WorkOrderStatus.invoicing,
    raw_request=(
        "Electrical panel upgrade needed at Delgado Electric back office. "
        "Current 100A panel is overloaded — need upgrade to 200A. "
        "Client: Delgado Electric. Urgency: normal."
    ),
    classification=Classification(
        job_type="Electrical panel upgrade",
        entities={
            "location": "back office",
            "client": "Delgado Electric",
            "urgency": "normal",
            "asset": "electrical panel",
            "upgrade": "100A to 200A",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Wed · 8:00 AM", "Thu · 12:00 PM"],
        outreach_draft={
            "subject": "Panel upgrade appointment — Delgado Electric",
            "body": (
                "Hi,\n\nWe're ready to schedule the 200A panel upgrade at your back office. "
                "We have availability Wednesday at 8:00 AM or Thursday at 12:00 PM.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[
            {"name": "200A main breaker panel", "qty": 1, "price": 420.00},
            {"name": "Circuit breakers (20A)", "qty": 8, "price": 12.00},
            {"name": "Copper wire (10 AWG, 50ft)", "qty": 2, "price": 45.00},
        ],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=True,
        invoice_approved=False,
    ),
)

_WO_1037 = WorkOrder(
    id="wo-1037",
    status=WorkOrderStatus.complete,
    raw_request=(
        "Water heater installation at Oak Street Plumbing warehouse. "
        "Replace 40-gallon gas water heater. Client: Oak Street Plumbing. Urgency: normal."
    ),
    classification=Classification(
        job_type="Water heater installation",
        entities={
            "location": "warehouse",
            "client": "Oak Street Plumbing",
            "urgency": "normal",
            "asset": "water heater",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Mon · 10:00 AM"],
        outreach_draft={
            "subject": "Water heater installation — Oak Street Plumbing",
            "body": (
                "Hi,\n\nYour water heater installation is confirmed for Monday at 10:00 AM.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[
            {"name": "40-gal gas water heater", "qty": 1, "price": 480.00},
            {"name": "Flexible gas connector", "qty": 1, "price": 18.00},
            {"name": "Pressure relief valve", "qty": 1, "price": 22.00},
        ],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=True,
        invoice_approved=True,
    ),
)

_WO_1035 = WorkOrder(
    id="wo-1035",
    status=WorkOrderStatus.scheduling,
    raw_request=(
        "Rooftop unit diagnostic for Maplewood HVAC main building. "
        "Unit is underperforming — need diagnostic and report. "
        "Client: Maplewood HVAC. Urgency: low."
    ),
    classification=Classification(
        job_type="Rooftop unit diagnostic",
        entities={
            "location": "main building rooftop",
            "client": "Maplewood HVAC",
            "urgency": "low",
            "asset": "rooftop HVAC unit",
        },
        completeness_flags=[],
    ),
    schedule=Schedule(
        proposed_times=["Fri · 2:00 PM", "Mon · 9:00 AM"],
        outreach_draft={
            "subject": "Rooftop unit diagnostic — Maplewood HVAC",
            "body": (
                "Hi,\n\nWe can schedule the rooftop unit diagnostic for Friday at 2:00 PM "
                "or Monday at 9:00 AM. Please let us know your preference.\n\nThanks,\nForemanAI"
            ),
        },
        parts_suggestion=[],
    ),
    approvals=Approvals(
        intake_approved=True,
        scheduling_approved=False,
        invoice_approved=False,
    ),
)


async def seed_demo_work_orders() -> None:
    for wo in [_MAPLEWOOD, _DELGADO, _WO_1041, _WO_1040, _WO_1039, _WO_1037, _WO_1035]:
        existing = await get_work_order(wo.id)
        if existing is None:
            await save_work_order(wo)
            logger.info("seeded demo work order: %s", wo.id)
        else:
            logger.debug("demo work order already exists, skipping: %s", wo.id)
