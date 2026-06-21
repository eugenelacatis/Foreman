from __future__ import annotations

import json
import logging
import uuid

import httpx
import os
from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from opentelemetry import trace

import sentry_sdk
from fastapi import APIRouter, Body, HTTPException

from backend.agents.armoriq_client import check_action, sign_plan
from backend.agents.invoicing_agent import run_invoicing as _run_invoicing
from backend.agents.question_map import question_for_flags
from backend.agents.voice_client import LiveTranscriber, synthesize
from backend.models.work_order import Approvals, Invoice, WorkOrder, WorkOrderStatus
from backend.orchestration.pipeline import run_intake as _run_intake_stage
from backend.orchestration.pipeline import advance_pipeline
from backend.state.invoice_history import search_invoice_history
from backend.state.redis_client import get_work_order, save_work_order

logger = logging.getLogger(__name__)

tracer = trace.get_tracer("foreman.voice")

router = APIRouter()


@router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(raw_request: str = Body(..., embed=True)) -> WorkOrder:
    wo = WorkOrder(
        id=str(uuid.uuid4()),
        status=WorkOrderStatus.intake,
        raw_request=raw_request,
    )
    await save_work_order(wo)
    sentry_sdk.set_tag("work_order_id", wo.id)
    sentry_sdk.set_tag("work_order_status", wo.status)
    wo = await _run_intake_stage(wo)
    await save_work_order(wo)
    return wo


@router.get("/work-orders/{id}", response_model=WorkOrder)
async def get_work_order_route(id: str) -> WorkOrder:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    sentry_sdk.set_tag("work_order_id", wo.id)
    sentry_sdk.set_tag("work_order_status", wo.status)
    return wo


@router.post("/work-orders/{id}/approve", response_model=WorkOrder)
async def approve_work_order(
    id: str,
    stage: str = Body(..., embed=True),
) -> WorkOrder:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    sentry_sdk.set_tag("work_order_id", wo.id)
    sentry_sdk.set_tag("work_order_status", wo.status)

    if stage not in ("intake", "scheduling", "invoice"):
        raise HTTPException(status_code=400, detail=f"Unknown stage: {stage}")

    plan_id = await sign_plan(f"approve_{stage}", {"work_order_id": id, "stage": stage})
    check = await check_action(f"approve_{stage}", plan_id)
    if not check["allowed"]:
        raise HTTPException(
            status_code=409,
            detail={"blocked": True, "action": f"approve_{stage}", "reason": check["reason"]},
        )

    if stage == "intake":
        wo.approvals.intake_approved = True
        wo.status = WorkOrderStatus.scheduling
    elif stage == "scheduling":
        if not wo.approvals.intake_approved:
            raise HTTPException(status_code=422, detail="Intake must be approved before approving scheduling.")
        wo.approvals.scheduling_approved = True
        wo.status = WorkOrderStatus.invoicing
    elif stage == "invoice":
        if not wo.approvals.intake_approved or not wo.approvals.scheduling_approved:
            raise HTTPException(status_code=422, detail="Scheduling must be approved before approving invoice.")
        wo.approvals.invoice_approved = True
        wo.status = WorkOrderStatus.complete

    await save_work_order(wo)
    advanced = await advance_pipeline(id)
    return advanced if advanced is not None else wo


@router.get("/work-orders/{id}/invoice-history")
async def invoice_history(id: str, query: str = "") -> list[dict]:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    sentry_sdk.set_tag("work_order_id", wo.id)
    sentry_sdk.set_tag("work_order_status", wo.status)
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
    sentry_sdk.set_tag("work_order_id", wo.id)
    sentry_sdk.set_tag("work_order_status", wo.status)

    prior_invoice = wo.invoice.model_dump() if wo.invoice else None
    result = await _run_invoicing(
        wo.model_dump(), user_message=message, prior_invoice=prior_invoice
    )

    invoice_data = result.get("invoice", {})
    # Carry invoice_id forward from prior state; generate one if this is the first completion
    invoice_id = (
        invoice_data.get("invoice_id")
        or (prior_invoice or {}).get("invoice_id")
        or f"INV-{uuid.uuid4().hex[:8].upper()}"
    )
    wo.invoice = Invoice(
        invoice_id=invoice_id,
        line_items=invoice_data.get("line_items", []),
        rates=invoice_data.get("rates", {}),
        template_filled=invoice_data.get("template_filled"),
        vendor_email_draft=invoice_data.get("vendor_email_draft"),
        missing_fields=result.get("missing_fields", []),
        conversation_history=result.get("conversation_history", []),
    )
    await save_work_order(wo)

    reply = result.get("question_for_user") or (
        "Invoice complete — ready for your approval."
        if result.get("status") == "COMPLETE"
        else f"Still need: {', '.join(result.get('missing_fields', []))}"
    )
    return {"reply": reply, "work_order": wo}


@router.post("/work-orders/{id}/armoriq-check")
async def armoriq_check(id: str, action: str = Body(..., embed=True)) -> dict:
    wo = await get_work_order(id)
    if wo is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    plan_id = await sign_plan(action, {"work_order_id": id})
    result = await check_action(action, plan_id)
    return result


@router.post("/voice-turn")
async def voice_turn(
    audio: UploadFile = File(...),
    work_order_id: str | None = Form(None),
) -> dict:
    """Single voice turn: transcribe audio, run intake, return question or complete."""
    data = await audio.read()

    # Transcribe via Deepgram pre-recorded API
    dg_key = os.getenv("DEEPGRAM_API_KEY", "")
    transcript = ""
    if dg_key and data:
        try:
            async with httpx.AsyncClient(timeout=30) as http:
                resp = await http.post(
                    "https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true",
                    headers={"Authorization": f"Token {dg_key}", "Content-Type": "audio/webm"},
                    content=data,
                )
                resp.raise_for_status()
                transcript = (
                    resp.json()
                    .get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])[0]
                    .get("transcript", "")
                    .strip()
                )
        except Exception as e:
            logger.warning("Deepgram pre-recorded failed: %s", e)

    logger.warning("voice-turn: audio=%d bytes, transcript=%r", len(data), transcript)
    if not transcript:
        return {"status": "retry", "question": "I didn't catch that. Please try again."}

    # Load or create work order
    wo: WorkOrder
    if work_order_id:
        existing = await get_work_order(work_order_id)
        wo = existing if existing is not None else WorkOrder(id=str(uuid.uuid4()), raw_request="")
    else:
        wo = WorkOrder(id=str(uuid.uuid4()), raw_request="")

    wo.raw_request = (wo.raw_request + " " + transcript).strip()
    wo = await _run_intake_stage(wo)
    await save_work_order(wo)

    flags = wo.classification.completeness_flags if wo.classification else []
    question = question_for_flags(flags)

    if question is None:
        return {"status": "complete", "transcript": transcript, "work_order": wo.model_dump(mode="json")}

    return {"status": "question", "transcript": transcript, "question": question, "work_order_id": wo.id}


async def _send_json(ws: WebSocket, payload: dict) -> None:
    await ws.send_text(json.dumps(payload))


@router.websocket("/ws/work-orders/voice")
async def voice_intake(ws: WebSocket) -> None:
    """Live-streaming voice intake.

    Protocol (client <-> server):
      client -> binary frames : audio chunks (e.g. webm/opus from MediaRecorder)
      client -> {"event": "end_turn"} : caller finished speaking this turn
      client -> {"event": "done"} : caller hung up / cancel

      server -> {"event": "transcript", "text": ...} : what we heard this turn
      server -> {"event": "question", "text": ..., "has_audio": bool, "id": ...}
                followed by a binary TTS frame when has_audio is true
      server -> {"event": "complete", "work_order": {...}} : intake finished

    The loop transcribes a turn, merges it into raw_request, re-runs intake, and
    speaks back the first missing-info question until none remain.
    """
    await ws.accept()

    wo = WorkOrder(id=str(uuid.uuid4()), raw_request="")
    await save_work_order(wo)

    try:
        while True:
            with tracer.start_as_current_span("voice.turn") as turn_span:
                turn_span.set_attribute("work_order.id", wo.id)

                # --- collect one turn of audio until the client signals end_turn ---
                async with LiveTranscriber() as stt:
                    ended = False
                    audio_bytes = 0
                    chunk_count = 0
                    while True:
                        msg = await ws.receive()
                        if msg.get("type") == "websocket.disconnect":
                            return
                        if msg.get("bytes") is not None:
                            chunk = msg["bytes"]
                            chunk_count += 1
                            audio_bytes += len(chunk)
                            await stt.send(chunk)
                            continue
                        text = msg.get("text")
                        if text is None:
                            continue
                        try:
                            event = json.loads(text).get("event")
                        except (ValueError, TypeError):
                            continue
                        if event == "done":
                            return
                        if event == "end_turn":
                            ended = True
                            break
                    logger.warning("voice turn: %d chunks, %d bytes total", chunk_count, audio_bytes)
                    if not ended:
                        return
                    transcript = await stt.finish()

                # skip empty transcripts — let the user try again without closing the session
                if not transcript.strip():
                    logger.warning("voice turn produced empty transcript — asking user to retry")
                    await _send_json(ws, {"event": "retry", "text": "I didn't catch that, can you please repeat?"})
                    continue

                # --- merge the turn into raw_request and re-run intake ---
                wo.raw_request = (wo.raw_request + " " + transcript).strip()
                turn_span.set_attribute("voice.transcript", transcript)
                await _send_json(ws, {"event": "transcript", "text": transcript})

                wo = await _run_intake_stage(wo)
                await save_work_order(wo)

                flags = (
                    wo.classification.completeness_flags if wo.classification else []
                )

                # --- gap-fill decision: which missing field do we ask about? ---
                with tracer.start_as_current_span("voice.gap_fill") as gap_span:
                    gap_span.set_attribute("voice.completeness_flags", flags)
                    question = question_for_flags(flags)
                    gap_span.set_attribute("voice.complete", question is None)
                    if question is not None:
                        gap_span.set_attribute("voice.chosen_question", question)

                logger.info(
                    "voice turn: flags=%r  question=%r  complete=%s",
                    flags, question, question is None,
                )

                if question is None:
                    turn_span.set_attribute("voice.complete", True)
                    await _send_json(
                        ws,
                        {"event": "complete", "work_order": wo.model_dump(mode="json")},
                    )
                    return

                # --- speak the follow-up question (audio primary, text fallback) ---
                audio = await synthesize(question)
                turn_span.set_attribute("voice.has_audio", audio is not None)
                await _send_json(
                    ws,
                    {
                        "event": "question",
                        "text": question,
                        "has_audio": audio is not None,
                        "id": wo.id,
                    },
                )
                if audio is not None:
                    await ws.send_bytes(audio)
                # loop back for the caller's spoken answer
    except WebSocketDisconnect:
        return
    except Exception as err:  # never let a voice glitch crash the socket
        logger.warning("voice_intake error: %s", err)
        try:
            await _send_json(ws, {"event": "error", "text": "Voice session ended."})
        except Exception:
            pass
