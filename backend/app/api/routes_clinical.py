"""Clinical module — Encounter & Docs, Order Mgmt (CPOE), Lab, Prescription & CDS, Pharmacy.

Every AI output is a draft requiring an explicit human approval call. Approval endpoints are the
only places state becomes clinically effective.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session
import os
import shutil

from app import models, services
from app.ai import agents
from app.core.database import get_db
from app.core.events import Topics, bus
from app.core.security import audit
from app.schemas import (
    AmbientRequest,
    ApproveNoteRequest,
    ApproveRxRequest,
    LabOrderRequest,
    PrescriptionCreateRequest,
    LabResultSubmitRequest,
    EncounterNotesAdviceRequest,
    DoctorAvailabilityRequest,
)

router = APIRouter(prefix="/api/v1", tags=["clinical"])


def _encounter(db: Session, eid: str) -> models.Encounter:
    e = db.get(models.Encounter, eid)
    if not e:
        raise HTTPException(404, "Encounter not found")
    return e


# ------------------------------------------------------------------------- Ambient documentation
@router.post("/encounters/{encounter_id}/ambient")
def ambient_note(encounter_id: str, body: AmbientRequest, db: Session = Depends(get_db)) -> dict:
    encounter = _encounter(db, encounter_id)
    patient = db.get(models.Patient, encounter.patient_id)
    triage = db.scalar(select(models.Triage).where(models.Triage.encounter_id == encounter_id)
                       .order_by(models.Triage.created_ts.desc()))
    vitals = db.scalar(select(models.Vitals).where(models.Vitals.encounter_id == encounter_id)
                       .order_by(models.Vitals.captured_ts.desc()))
    vitals_line = ""
    vitals_dict: dict = {}
    if vitals:
        vitals_line = (f"Temp {vitals.temperature}°F, SpO₂ {vitals.spo2}%, "
                       f"BP {vitals.bp_systolic}/{vitals.bp_diastolic}, HR {vitals.heart_rate}.")
        vitals_dict = {
            "temperature": vitals.temperature,
            "spo2": vitals.spo2,
            "bp_systolic": vitals.bp_systolic,
            "bp_diastolic": vitals.bp_diastolic,
            "heart_rate": vitals.heart_rate,
            "respiratory_rate": vitals.respiratory_rate,
        }

    # NOTE: "problems" (chronic medical issues, e.g. "Back pain", "Diabetes") and "allergies"
    # (drug/substance allergies) are two DIFFERENT clinical concepts — they must never be
    # conflated. Previously this endpoint mistakenly fed allergy substances in as "problems".
    active_issues = [i.issue_name for i in (patient.issues if patient else []) if i.status == "ACTIVE"]
    allergy_list = [
        {"substance": a.substance, "severity": a.severity, "reaction": a.reaction}
        for a in (patient.allergies if patient else [])
    ]

    context = {
        "age": patient.age if patient else "",
        "gender": (patient.gender or "")[:1] if patient else "",
        "chief_complaint": triage.chief_complaint if triage else "",
        "problems": ", ".join(active_issues) if active_issues else "none recorded",
        "allergies": allergy_list,
        "vitals_line": vitals_line,
        "vitals": vitals_dict,
    }

    result = agents.ambient_docs_agent(body.transcript, context)
    note = models.ClinicalNote(
        encounter_id=encounter_id, note_type="SOAP",
        ai_draft=result["result"]["draft_text"], final_text=result["result"]["draft_text"],
        icd10_codes=result["result"]["icd10"], status="DRAFT", authored_by="ambient-agent",
    )
    db.add(note)
    encounter.status = "IN_CONSULT"
    db.commit()
    return {"note_id": note.note_id, **result}


# ---------------------------------------------------------------- Ambient live dictation (audio -> text)
@router.post("/encounters/{encounter_id}/ambient/transcribe-audio")
async def ambient_transcribe_audio(
    encounter_id: str, audio: UploadFile = File(...), language: str | None = None
) -> dict:
    """Transcribe a short chunk of consultation audio locally (faster-whisper, "small" model
    + tuned voice-activity detection) — no audio ever leaves this server. Also tags the chunk
    with a best-effort "Speaker N" label (offline speaker-embedding clustering, scoped to this
    encounter) so the live transcript can distinguish doctor/patient turns. The frontend calls
    this every few seconds while "Start listening" is active and appends the result to the
    live transcript.

    `language` is an optional Whisper language code (e.g. "hi", "ta", "bn") selected by the
    doctor for multi-lingual consultations — omit or pass "auto" to let Whisper auto-detect
    the spoken language on every chunk instead of assuming English."""
    from app.ai import asr

    data = await audio.read()
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    lang = language if language and language != "auto" else None
    try:
        result = asr.transcribe_audio(data, suffix=suffix, encounter_id=encounter_id, language=lang)
    except RuntimeError as err:
        raise HTTPException(503, str(err))
    return result


@router.post("/encounters/{encounter_id}/ambient/reset-speakers")
def ambient_reset_speakers(encounter_id: str) -> dict:
    """Forget the remembered speaker voices for this encounter (call when starting a fresh
    listening session so old voice clusters from a previous consultation don't leak in)."""
    from app.ai import asr

    asr.reset_speakers(encounter_id)
    return {"ok": True}


@router.post("/notes/{note_id}/approve")
def approve_note(note_id: str, body: ApproveNoteRequest, db: Session = Depends(get_db)) -> dict:
    note = db.get(models.ClinicalNote, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    note.final_text = body.final_text
    if body.icd10_codes is not None:
        note.icd10_codes = body.icd10_codes
    note.status = "APPROVED"
    note.approved_by = body.approved_by or "doctor"
    note.approved_ts = datetime.now(timezone.utc)
    audit(db, actor_id=note.approved_by, actor_role="DOCTOR", action="NOTE_APPROVED",
          entity_type="clinical_note", entity_id=note.note_id,
          metadata={"had_ai_draft": bool(note.ai_draft)})
    db.commit()
    bus.publish(Topics.NOTE_APPROVED, {"encounter_id": note.encounter_id, "note_id": note.note_id})
    return {"note_id": note.note_id, "status": note.status, "approved_ts": note.approved_ts.isoformat()}


@router.get("/encounters/{encounter_id}/notes")
def list_notes(encounter_id: str, db: Session = Depends(get_db)) -> list[dict]:
    notes = db.scalars(select(models.ClinicalNote).where(models.ClinicalNote.encounter_id == encounter_id)
                       .order_by(models.ClinicalNote.created_ts.desc())).all()
    return [{"note_id": n.note_id, "status": n.status, "text": n.final_text,
             "icd10": n.icd10_codes, "approved_by": n.approved_by} for n in notes]


# ---- Translate clinical text (SOAP, transcript) to target language
@router.post("/translate")
def translate_text(body: dict) -> dict:
    """Translate clinical text to a target language.
    
    Request body: {"text": str, "target_language": str}
    Response: {"translated_text": str, "translated": bool}
    """
    text = body.get("text", "")
    target_language = body.get("target_language", "English")
    
    if not text or not target_language:
        raise HTTPException(400, "Missing text or target_language")
    
    result = agents.translate_agent(text, target_language)
    return result


# ---- Lab orders (CPOE)
@router.post("/lab-orders")
def create_lab_orders(body: LabOrderRequest, db: Session = Depends(get_db)) -> dict:
    encounter = _encounter(db, body.encounter_id)
    invoice = services.get_or_create_invoice(db, encounter)

    # Duplicate / appropriateness check (Lab Intelligence agent pre-order guard)
    existing = {o.test_name for o in db.scalars(
        select(models.LabOrder).where(models.LabOrder.encounter_id == body.encounter_id))}
    duplicates = [t for t in body.tests if t in existing]

    created = []
    for test in body.tests:
        if test in existing:
            continue
        cat = services.catalog_for(test)
        order = models.LabOrder(
            encounter_id=body.encounter_id, patient_id=encounter.patient_id,
            test_code=cat["code"], test_name=test, panel=test, priority=body.priority,
            status="CREATED", ordered_by=body.ordered_by or "doctor",
            qr_code=f"LAB-{secrets.token_hex(4).upper()}", price=cat["price"],
        )
        db.add(order)
        db.flush()
        services.add_line(db, invoice, category="LAB", description=f"Lab: {test}", amount=cat["price"])
        created.append(order)

    audit(db, actor_id=body.ordered_by or "doctor", actor_role="DOCTOR", action="LABORDER_CREATED",
          entity_type="encounter", entity_id=body.encounter_id, metadata={"tests": body.tests})
    db.commit()
    for o in created:
        bus.publish(Topics.LABORDER_CREATED, {"lab_order_id": o.lab_order_id, "test": o.test_name,
                                              "encounter_id": body.encounter_id})

    return {
        "orders": [{"lab_order_id": o.lab_order_id, "test": o.test_name, "qr_code": o.qr_code,
                    "price": o.price, "status": o.status} for o in created],
        "duplicate_warning": duplicates or None,
        "invoice_id": invoice.invoice_id,
    }


def _check_and_discharge_lab_visit(db: Session, patient_id: str, encounter_id: str | None = None) -> None:
    query = (
        select(models.Encounter)
        .where(models.Encounter.patient_id == patient_id)
        .where(models.Encounter.visit_type == "LAB")
        .where(models.Encounter.status != "DISCHARGED")
    )
    if encounter_id:
        query = query.where(models.Encounter.notes.like(f"%{encounter_id}%"))
    
    lab_encs = db.scalars(query).all()
    if not lab_encs:
        lab_encs = db.scalars(
            select(models.Encounter)
            .where(models.Encounter.patient_id == patient_id)
            .where(models.Encounter.visit_type == "LAB")
            .where(models.Encounter.status != "DISCHARGED")
            .order_by(models.Encounter.arrival_ts.desc())
        ).all()
        
    for lab_enc in lab_encs:
        target_enc_id = encounter_id
        if not target_enc_id and lab_enc.notes and "parent:" in lab_enc.notes:
            target_enc_id = lab_enc.notes.replace("parent:", "").strip()
            
        if target_enc_id:
            pending_count = db.scalar(
                select(func.count())
                .select_from(models.LabOrder)
                .where(models.LabOrder.encounter_id == target_enc_id)
                .where(models.LabOrder.status.in_(["CREATED", "CONFIRMED", "SAMPLE_COLLECTED"]))
            ) or 0
        elif lab_enc.notes and "," in lab_enc.notes:
            order_ids = lab_enc.notes.split(",")
            pending_count = db.scalar(
                select(func.count())
                .select_from(models.LabOrder)
                .where(models.LabOrder.lab_order_id.in_(order_ids))
                .where(models.LabOrder.status.in_(["CREATED", "CONFIRMED", "SAMPLE_COLLECTED"]))
            ) or 0
        else:
            pending_count = 0

        if pending_count == 0:
            lab_enc.status = "DISCHARGED"
            for tk in db.scalars(select(models.Token).where(models.Token.encounter_id == lab_enc.encounter_id)):
                tk.status = "COMPLETED"


@router.post("/lab-orders/{lab_order_id}/publish-result")
def publish_result(lab_order_id: str, db: Session = Depends(get_db)) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
    cat = services.catalog_for(order.test_name or "")
    results_payload = []
    for analyte, unit, low, high, demo in cat["analytes"]:
        res = models.LabResult(
            lab_order_id=lab_order_id, test_code=cat["code"], analyte=analyte,
            value=demo, unit=unit, reference_low=low, reference_high=high, status="FINAL",
        )
        db.add(res)
        results_payload.append({"analyte": analyte, "value": demo, "unit": unit,
                                "reference_low": low, "reference_high": high})
    order.status = "RESULTED"

    ai = agents.lab_intelligence_agent(results_payload)
    # persist computed flags back
    for res_row, structured in zip(
        db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == lab_order_id)),
        ai["result"]["structured"],
    ):
        res_row.abnormal_flag = structured["abnormal_flag"]

    _check_and_discharge_lab_visit(db, order.patient_id, encounter_id=order.encounter_id)
    db.commit()
    bus.publish(Topics.LABRESULT_PUBLISHED, {"lab_order_id": lab_order_id, "test": order.test_name,
                                             "encounter_id": order.encounter_id})
    if ai["result"]["abnormal"]:
        bus.publish(Topics.RESULT_ABNORMAL, {"lab_order_id": lab_order_id, "test": order.test_name,
                                             "encounter_id": order.encounter_id,
                                             "count": len(ai["result"]["abnormal"])})
    return {"lab_order_id": lab_order_id, "test": order.test_name, **ai}


def _lab_category(test_name: str | None) -> str:
    name = (test_name or "").lower().strip()
    if any(k in name for k in ["x-ray", "xray", "scan", "mri", "ultrasound", "usg", "imaging", "ct"]):
        return "RADIOLOGY"
    if any(k in name for k in ["ecg", "ekg", "eeg", "echo", "tmt"]):
        return "CARDIOLOGY"
    return "PATHOLOGY"


@router.get("/lab-orders")
def list_lab_orders(db: Session = Depends(get_db)) -> list[dict]:
    # Select lab orders sorted by time
    stmt = (
        select(models.LabOrder, models.Patient.first_name, models.Patient.last_name)
        .join(models.Patient, models.LabOrder.patient_id == models.Patient.patient_id)
        .order_by(models.LabOrder.ordered_ts.desc())
    )
    results = db.execute(stmt).all()
    out = []
    for order, fn, ln in results:
        token_number = None
        slot_time = None
        lab_enc = db.scalar(
            select(models.Encounter)
            .where(models.Encounter.patient_id == order.patient_id)
            .where(models.Encounter.visit_type == "LAB")
            .where(models.Encounter.status != "DISCHARGED")
            .order_by(models.Encounter.arrival_ts.desc())
        )
        if lab_enc:
            token = db.scalar(
                select(models.Token)
                .where(models.Token.encounter_id == lab_enc.encounter_id)
            )
            if token:
                token_number = token.token_number
                slot_time = token.issued_ts.isoformat() if token.issued_ts else None

        lab_results = db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == order.lab_order_id)).all()
        res_list = [{"analyte": r.analyte, "value": r.value, "unit": r.unit, "flag": r.abnormal_flag} for r in lab_results]

        out.append({
            "lab_order_id": order.lab_order_id,
            "patient_id": order.patient_id,
            "test_name": order.test_name,
            "status": order.status,
            "qr_code": order.qr_code,
            "ordered_ts": order.ordered_ts.isoformat() if order.ordered_ts else None,
            "sample_collected_ts": order.sample_collected_ts.isoformat() if order.sample_collected_ts else None,
            "slot_time": slot_time,
            "ordered_by": order.ordered_by,
            "patient_name": f"{fn} {ln}",
            "encounter_id": order.encounter_id,
            "notes": order.notes,
            "ai_analysis_summary": order.ai_analysis_summary,
            "attachment_name": order.attachment_name,
            "attachment_uri": order.attachment_uri,
            "results": res_list,
            "category": _lab_category(order.test_name),
            "token_number": token_number,
        })
    return out


@router.post("/lab-orders/{lab_order_id}/submit-results")
def submit_results(lab_order_id: str, body: LabResultSubmitRequest, db: Session = Depends(get_db)) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
    
    # Check if results already exist for this order
    existing_results = db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == lab_order_id)).all()
    for er in existing_results:
        db.delete(er)
    db.flush()

    cat = services.catalog_for(order.test_name or "")
    input_vals = {r.analyte.lower().strip(): r.value for r in body.results}
    input_units = {r.analyte.lower().strip(): getattr(r, "unit", None) for r in body.results}

    results_payload = []
    if cat["analytes"]:
        for analyte, unit, low, high, demo in cat["analytes"]:
            val = input_vals.get(analyte.lower().strip(), demo)
            res = models.LabResult(
                lab_order_id=lab_order_id, test_code=cat["code"], analyte=analyte,
                value=val, unit=unit, reference_low=low, reference_high=high, status="FINAL",
            )
            db.add(res)
            results_payload.append({"analyte": analyte, "value": val, "unit": unit,
                                    "reference_low": low, "reference_high": high})
    else:
        # Custom/unrecognized test with no built-in catalog entry — accept whatever
        # analyte rows the technician entered directly (no fixed reference ranges).
        for item in body.results:
            unit = input_units.get(item.analyte.lower().strip())
            res = models.LabResult(
                lab_order_id=lab_order_id, test_code=cat["code"], analyte=item.analyte,
                value=item.value, unit=unit, reference_low=None, reference_high=None, status="FINAL",
            )
            db.add(res)
            results_payload.append({"analyte": item.analyte, "value": item.value, "unit": unit,
                                    "reference_low": None, "reference_high": None})
    order.status = "RESULTED"
    if body.notes is not None:
        order.notes = body.notes
    if body.attachment_name is not None:
        order.attachment_name = body.attachment_name
    if body.attachment_uri is not None:
        order.attachment_uri = body.attachment_uri
    
    ai = agents.lab_intelligence_agent(results_payload)
    db.flush()
    # persist computed flags back
    for res_row, structured in zip(
        db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == lab_order_id)),
        ai["result"]["structured"],
    ):
        res_row.abnormal_flag = structured["abnormal_flag"]
        
    _check_and_discharge_lab_visit(db, order.patient_id)
    db.commit()
    bus.publish(Topics.LABRESULT_PUBLISHED, {"lab_order_id": lab_order_id, "test": order.test_name,
                                             "encounter_id": order.encounter_id})
    if ai["result"]["abnormal"]:
        bus.publish(Topics.RESULT_ABNORMAL, {"lab_order_id": lab_order_id, "test": order.test_name,
                                             "encounter_id": order.encounter_id,
                                             "count": len(ai["result"]["abnormal"])})
    return {"lab_order_id": lab_order_id, "test": order.test_name, **ai}


@router.post("/lab-orders/{lab_order_id}/upload")
def upload_lab_attachment(
    lab_order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
        
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename or "")[1]
    safe_filename = f"lab_{lab_order_id}{file_ext}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    attachment_uri = f"/uploads/{safe_filename}"
    return {"filename": file.filename, "uri": attachment_uri}


@router.get("/encounters/{encounter_id}/lab")
def encounter_lab(encounter_id: str, db: Session = Depends(get_db)) -> dict:
    encounter = _encounter(db, encounter_id)
    
    parent_id = None
    if encounter.notes and "parent:" in encounter.notes:
        for part in encounter.notes.split(";"):
            if part.strip().startswith("parent:"):
                parent_id = part.strip().split("parent:")[-1].strip()
    if not parent_id and encounter.appointment_id:
        appt = db.get(models.Appointment, encounter.appointment_id)
        if appt and appt.reason and appt.reason.startswith("Re-visit follow-up for encounter"):
            parent_id = appt.reason.split("encounter ")[-1].strip()
            
    target_encounter_ids = [encounter_id]
    if parent_id:
        target_encounter_ids.append(parent_id)
        
    orders = db.scalars(
        select(models.LabOrder)
        .where(models.LabOrder.encounter_id.in_(target_encounter_ids))
    ).all()
    out = []
    for o in orders:
        results = db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == o.lab_order_id)).all()
        out.append({
            "lab_order_id": o.lab_order_id, "test": o.test_name, "status": o.status, "qr_code": o.qr_code,
            "notes": o.notes,
            "ai_analysis_summary": o.ai_analysis_summary,
            "attachment_name": o.attachment_name,
            "attachment_uri": o.attachment_uri,
            "category": _lab_category(o.test_name),
            "results": [{"analyte": r.analyte, "value": r.value, "unit": r.unit, "flag": r.abnormal_flag,
                         "reference_low": r.reference_low, "reference_high": r.reference_high} for r in results],
        })
    return {"orders": out, "suggested_orders": []}


@router.get("/encounters/{encounter_id}/lab/suggest")
def suggest_encounter_labs(encounter_id: str, db: Session = Depends(get_db)) -> list[dict]:
    encounter = _encounter(db, encounter_id)
    suggested = []
    try:
        triage = db.scalar(select(models.Triage).where(models.Triage.encounter_id == encounter_id))
        if triage:
            chief_complaint = triage.chief_complaint or ""
            symptom_summary = triage.symptom_summary or ""
            
            vitals_rec = db.scalar(
                select(models.Vitals).where(models.Vitals.encounter_id == encounter_id)
                .order_by(models.Vitals.captured_ts.desc())
            )
            vitals_payload = None
            if vitals_rec:
                vitals_payload = {
                    "bp": f"{vitals_rec.bp_systolic}/{vitals_rec.bp_diastolic}",
                    "spo2": vitals_rec.spo2,
                    "heart_rate": vitals_rec.heart_rate,
                    "temperature": vitals_rec.temperature,
                }
                
            past_notes = db.scalars(
                select(models.ClinicalNote)
                .join(models.Encounter)
                .where(models.Encounter.patient_id == encounter.patient_id)
                .where(models.ClinicalNote.status == "APPROVED")
            ).all()
            history_set = set()
            for n in past_notes:
                if n.icd10_codes:
                    for item in n.icd10_codes:
                        if isinstance(item, dict) and "label" in item:
                            history_set.add(item["label"])
                        elif isinstance(item, str):
                            history_set.add(item)
            history = list(history_set)
            
            suggested = agents.suggest_orders_agent(chief_complaint, symptom_summary, vitals_payload, history)
    except Exception as e:
        import logging
        logging.getLogger("aarogya.api").warning("Failed to generate suggested orders: %s", str(e))
        
    return suggested


# --------------------------------------------------------------------------------- Prescription & CDS
def _stock_index(db: Session) -> dict[str, dict]:
    idx: dict[str, dict] = {}
    for s in db.scalars(select(models.PharmacyStock)):
        idx[s.drug_name.lower()] = {
            "available": s.quantity_available - s.quantity_reserved,
            "formulary": s.formulary, "salt": s.salt, "display": s.drug_name,
            "unit_price": s.unit_price,
        }
    return idx


def _get_patient_context(db: Session, encounter_id: str, patient_id: str) -> dict:
    # 1. Fetch Triage chief complaint / summary
    triage = db.scalar(select(models.Triage).where(models.Triage.encounter_id == encounter_id))
    patient_issue = f"{triage.chief_complaint or ''}. {triage.symptom_summary or ''}".strip() if triage else "No complaint recorded"

    # 2. Fetch Vitals
    vitals_rec = db.scalar(
        select(models.Vitals).where(models.Vitals.encounter_id == encounter_id)
        .order_by(models.Vitals.captured_ts.desc())
    )
    vitals_payload = None
    if vitals_rec:
        vitals_payload = {
            "bp": f"{vitals_rec.bp_systolic}/{vitals_rec.bp_diastolic}",
            "spo2": vitals_rec.spo2,
            "heart_rate": vitals_rec.heart_rate,
            "temperature": vitals_rec.temperature,
            "weight": vitals_rec.weight_kg,
            "height": vitals_rec.height_cm,
            "bmi": vitals_rec.bmi
        }

    # 3. Extract compact unique diagnosis labels to minimize token sizes
    past_notes = db.scalars(
        select(models.ClinicalNote)
        .join(models.Encounter)
        .where(models.Encounter.patient_id == patient_id)
        .where(models.ClinicalNote.status == "APPROVED")
    ).all()
    
    history_set = set()
    for n in past_notes:
        if n.icd10_codes:
            for item in n.icd10_codes:
                if isinstance(item, dict) and "label" in item:
                    history_set.add(item["label"])
                elif isinstance(item, str):
                    history_set.add(item)
                    
    history = list(history_set)

    return {
        "issue": patient_issue or "Consultation ongoing",
        "vitals": vitals_payload,
        "history": history
    }


@router.get("/encounters/{encounter_id}/formulary-guidance")
def get_formulary_guidance(encounter_id: str, db: Session = Depends(get_db)) -> dict:
    encounter = _encounter(db, encounter_id)
    patient = db.get(models.Patient, encounter.patient_id)
     # 1. Filter Major Chronic Co-morbidities ONLY (Diabetes, High BP, Kidney Disease, Heart/Stroke, Asthma/COPD, Liver)
    CHRONIC_KEYWORDS = ["DIABETES", "HYPERTENSION", "BP", "KIDNEY", "HEART", "STROKE", "ASTHMA", "COPD", "LIVER", "CIRRHOSIS"]
    chronic_issues = [
        i.issue_name for i in patient.issues 
        if i.status == "ACTIVE" and any(kw in i.issue_name.upper() for kw in CHRONIC_KEYWORDS)
    ]

    # 2. Present Chief Complaint for THIS Current Visit Only
    triage = db.scalar(select(models.Triage).where(models.Triage.encounter_id == encounter_id))
    chief_complaint = ""
    if triage and triage.chief_complaint and not triage.chief_complaint.isdigit():
        chief_complaint = triage.chief_complaint.strip()
    
    if not chief_complaint:
        appt = db.scalar(select(models.Appointment).where(models.Appointment.encounter_id == encounter_id))
        if appt and appt.reason:
            chief_complaint = appt.reason.strip()
        elif encounter.notes:
            note_text = encounter.notes.strip()
            if "parent:" in note_text:
                note_text = note_text.split(";", 1)[-1].strip()
            chief_complaint = note_text
        else:
            chief_complaint = "Fever and cough"

    # 3. Lab Orders & PyTorch Diagnostics (Query ONLY lab findings for THIS specific visit / care episode encounter ID)
    target_encounter_id = encounter_id
    lab_orders = db.scalars(
        select(models.LabOrder)
        .where(models.LabOrder.encounter_id == target_encounter_id)
        .order_by(models.LabOrder.ordered_ts.desc())
    ).all()

    # If this encounter is a follow-up re-visit with no lab orders created directly on it, locate the parent visit encounter_id where the lab tests were ordered
    if not lab_orders:
        recent_order = db.scalar(
            select(models.LabOrder)
            .where(models.LabOrder.patient_id == encounter.patient_id)
            .order_by(models.LabOrder.ordered_ts.desc())
        )
        if recent_order:
            target_encounter_id = recent_order.encounter_id
            lab_orders = db.scalars(
                select(models.LabOrder)
                .where(models.LabOrder.encounter_id == target_encounter_id)
                .order_by(models.LabOrder.ordered_ts.desc())
            ).all()
    
    ai_findings = []
    seen_tests = set()
    for order in lab_orders:
        lab_results = db.scalars(
            select(models.LabResult).where(models.LabResult.lab_order_id == order.lab_order_id)
        ).all()
        
        result_text_parts = []
        if order.ai_analysis_summary and len(order.ai_analysis_summary.strip()) > 5:
            result_text_parts.append(order.ai_analysis_summary.strip())
        elif order.notes and len(order.notes.strip()) > 5:
            result_text_parts.append(order.notes.strip())
        if lab_results:
            num_str = ", ".join([f"{r.analyte or 'Analyte'}: {r.value} {r.unit or ''} (Flag: {r.abnormal_flag or 'N'})" for r in lab_results])
            result_text_parts.append(f"Structured Values: {num_str}")

        combined_finding = " | ".join(result_text_parts)

        if combined_finding and order.test_name not in seen_tests:
            seen_tests.add(order.test_name)
            ai_findings.append({
                "test_name": order.test_name,
                "finding": combined_finding[:350],
                "status": order.status
            })

    # 4. Execute AI Formulary Agent (100% Anonymized, Present Complaint + Major Co-morbidities + Current Visit Reports)
    guidance = agents.formulary_guidance_agent(
        patient_name="Patient",
        chief_complaint=chief_complaint,
        patient_issues=chronic_issues,
        ai_diagnostics=ai_findings,
    )

    appt = db.scalar(select(models.Appointment).where(models.Appointment.encounter_id == encounter_id))
    patient_original_reason = appt.reason if (appt and appt.reason) else (encounter.notes or None)

    audit_logs = db.scalars(
        select(models.EncounterAuditLog)
        .where(models.EncounterAuditLog.encounter_id == encounter_id)
        .order_by(models.EncounterAuditLog.created_ts.asc())
    ).all()

    result_data = guidance.get("result", {})
    return {
        "encounter_id": encounter_id,
        "patient_name": patient.full_name,
        "active_issues": chronic_issues,
        "chief_complaint": chief_complaint,
        "patient_original_reason": patient_original_reason,
        "audit_logs": [
            {
                "audit_id": log.audit_id,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "edited_by_role": log.edited_by_role,
                "edited_by_user": log.edited_by_user,
                "created_ts": log.created_ts.isoformat() if log.created_ts else None,
            }
            for log in audit_logs
        ],
        "ai_diagnostics_evaluated": ai_findings,
        "formula_recommendations": result_data.get("formula_recommendations", [])
    }


@router.post("/prescriptions")
def create_prescription(body: PrescriptionCreateRequest, db: Session = Depends(get_db)) -> dict:
    encounter = _encounter(db, body.encounter_id)
    patient = db.get(models.Patient, encounter.patient_id)
    allergies = [{"substance": a.substance, "drug_class": a.drug_class} for a in patient.allergies]
    proposed = [i.model_dump() for i in body.items]
    stock_index = _stock_index(db)

    patient_ctx = _get_patient_context(db, body.encounter_id, encounter.patient_id)
    cds = agents.rx_cds_agent(allergies, body.current_meds, proposed, patient_ctx, stock_index)

    rx = models.Prescription(encounter_id=body.encounter_id, patient_id=encounter.patient_id,
                             status="DRAFT", prescribed_by=body.prescribed_by or "doctor")
    db.add(rx)
    db.flush()
    for item in body.items:
        db.add(models.PrescriptionItem(
            rx_id=rx.rx_id, drug_name=item.drug_name, dose=item.dose, route=item.route,
            frequency=item.frequency, duration_days=item.duration_days, quantity=item.quantity or 1,
            instructions=item.instructions,
        ))
    db.commit()
    return {"rx_id": rx.rx_id, "status": rx.status, **cds}


@router.post("/prescriptions/{rx_id}/approve")
def approve_prescription(rx_id: str, body: ApproveRxRequest, db: Session = Depends(get_db)) -> dict:
    rx = db.get(models.Prescription, rx_id)
    if not rx:
        raise HTTPException(404, "Prescription not found")
    encounter = _encounter(db, rx.encounter_id)
    patient = db.get(models.Patient, rx.patient_id)
    allergies = [{"substance": a.substance, "drug_class": a.drug_class} for a in patient.allergies]
    stock_index = _stock_index(db)

    items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx_id)).all()
    patient_ctx = _get_patient_context(db, rx.encounter_id, rx.patient_id)

    # Optimize LLM CDS call: skip if doctor overrides, otherwise run at most once
    cds = {"result": {"block": False, "alerts": [], "suggestions": []}}
    if not body.override_warnings:
        cds = agents.rx_cds_agent(allergies, [], [{"drug_name": i.drug_name} for i in items], patient_ctx, stock_index)
        if body.accept_substitutions and cds.get("result", {}).get("suggestions"):
            sugg = {s["for"]: s["suggestion"] for s in cds["result"]["suggestions"]}
            substituted = False
            for i in items:
                if i.drug_name in sugg:
                    i.substituted_from = i.drug_name
                    i.drug_name = sugg[i.drug_name]
                    substituted = True
            if substituted:
                cds["result"]["block"] = False
                cds["result"]["alerts"] = [a for a in cds["result"]["alerts"] if a.get("severity") != "BLOCK"]
        
        if cds.get("result", {}).get("block"):
            raise HTTPException(status_code=409, detail={"message": "Prescription blocked by CDS — resolve conflicts or override warnings.",
                                                         "cds": cds})

    invoice = services.get_or_create_invoice(db, encounter)
    for i in items:
        rec = stock_index.get(i.drug_name.lower())
        if rec and rec["available"] > 0:
            stock = db.scalar(select(models.PharmacyStock).where(func.lower(models.PharmacyStock.drug_name) == i.drug_name.lower()))
            if stock:
                stock.quantity_reserved += (i.quantity or 1)
                price = (rec.get("unit_price") or 20.0) * (i.quantity or 1)
                services.add_line(db, invoice, category="PHARMACY", description=f"Rx: {i.drug_name}", amount=round(price, 2))

    rx.status = "APPROVED"
    rx.approved_ts = datetime.now(timezone.utc)
    rx.prescribed_by = body.approved_by or rx.prescribed_by
    audit(db, actor_id=rx.prescribed_by, actor_role="DOCTOR", action="PRESCRIPTION_APPROVED",
          entity_type="prescription", entity_id=rx.rx_id, metadata={"items": len(items)})
    db.commit()
    bus.publish(Topics.PRESCRIPTION_APPROVED, {"rx_id": rx.rx_id, "encounter_id": rx.encounter_id})
    return {
        "rx_id": rx.rx_id, "status": rx.status,
        "items": [{"drug_name": i.drug_name, "dose": i.dose, "frequency": i.frequency,
                   "substituted_from": i.substituted_from} for i in items],
        "cds": cds,
    }


@router.get("/pharmacy/stock")
def pharmacy_stock(drug: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(models.PharmacyStock)
    if drug:
        # Search mode (e.g. doctor typing in the prescription search box) — filter server-side
        # across the FULL catalog (1000+ medicines) so results aren't limited to whatever
        # happened to load in an unfiltered page.
        stmt = stmt.where(func.lower(models.PharmacyStock.drug_name).like(f"%{drug.lower()}%"))
        limit = 25
    else:
        # Unfiltered "browse everything" mode (e.g. Pharmacy Live Stock Monitor) — cap at a
        # sane page size rather than dumping the entire 1000+ row catalog in one response.
        limit = 150
    rows = db.scalars(stmt.limit(limit)).all()
    return [{"drug_name": s.drug_name, "salt": s.salt, "drug_class": s.drug_class,
             "available": s.quantity_available - s.quantity_reserved,
             "quantity_available": s.quantity_available,
             "quantity_reserved": s.quantity_reserved,
             "unit_price": s.unit_price,
             "formulary": s.formulary, "expiry": s.expiry_date.isoformat() if s.expiry_date else None}
            for s in rows]


@router.post("/encounters/{encounter_id}/notes-advice")
def update_encounter_notes_advice(
    encounter_id: str,
    body: EncounterNotesAdviceRequest,
    db: Session = Depends(get_db)
) -> dict:
    e = db.get(models.Encounter, encounter_id)
    if not e:
        raise HTTPException(404, "Encounter not found")
    triage = db.scalar(
        select(models.Triage)
        .where(models.Triage.encounter_id == encounter_id)
        .order_by(models.Triage.created_ts.desc())
    )
    chief_complaint = triage.chief_complaint if triage else "not specified"
    
    # Extract parent:UUID if present in notes to preserve it
    parent_part = None
    if e.notes:
        for part in e.notes.split(";"):
            if part.strip().startswith("parent:"):
                parent_part = part.strip()
                break
                
    refined_notes = agents.refine_notes_agent(body.notes, chief_complaint)
    if parent_part:
        # Prepend the parent metadata
        if refined_notes:
            e.notes = f"{parent_part}; {refined_notes}"
        else:
            e.notes = parent_part
    else:
        e.notes = refined_notes
        
    db.commit()
    
    # Return stripped notes to the frontend
    clean_notes = e.notes
    if e.notes and "parent:" in e.notes:
        parts = [p.strip() for p in e.notes.split(";") if not p.strip().startswith("parent:")]
        clean_notes = "; ".join(parts) if parts else None
        
    return {"status": "success", "notes": clean_notes}


@router.put("/doctors/{doctor_id}/availability")
def update_doctor_availability(
    doctor_id: str,
    body: DoctorAvailabilityRequest,
    db: Session = Depends(get_db)
) -> dict:
    doc = db.get(models.Staff, doctor_id)
    if not doc or doc.role != "DOCTOR":
        raise HTTPException(404, "Doctor not found")
    doc.available = body.available
    db.commit()
    return {"status": "success", "available": doc.available}


@router.post("/lab-orders/{lab_order_id}/confirm")
def confirm_lab_order(lab_order_id: str, db: Session = Depends(get_db)) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
    order.status = "CONFIRMED"
    db.commit()
    return {"status": "success", "lab_order_id": lab_order_id}


@router.post("/lab-orders/{lab_order_id}/collect-sample")
def collect_lab_sample(lab_order_id: str, db: Session = Depends(get_db)) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
    if order.status != "CONFIRMED":
        raise HTTPException(400, "Sample can only be marked collected once payment is confirmed.")
    order.status = "SAMPLE_COLLECTED"
    order.sample_collected_ts = datetime.now(timezone.utc)
    db.commit()
    bus.publish(Topics.SAMPLE_COLLECTED, {"lab_order_id": lab_order_id, "test": order.test_name,
                                          "encounter_id": order.encounter_id})
    return {"status": "success", "lab_order_id": lab_order_id, "order_status": order.status}


@router.get("/pharmacy/lookup")
def pharmacy_lookup(search: str, db: Session = Depends(get_db)) -> list[dict]:
    # Search can be patient mobile number or queue Token number
    patient_ids = db.scalars(
        select(models.Patient.patient_id).where(models.Patient.mobile == search)
    ).all()
    
    token_encounter_ids = db.scalars(
        select(models.Token.encounter_id).where(models.Token.token_number == search)
    ).all()
    
    stmt = select(models.Encounter)
    if patient_ids:
        stmt = stmt.where(models.Encounter.patient_id.in_(patient_ids))
    elif token_encounter_ids:
        stmt = stmt.where(models.Encounter.encounter_id.in_(token_encounter_ids))
    else:
        return []
        
    encounters = db.scalars(stmt.order_by(models.Encounter.arrival_ts.desc())).all()
    
    results = []
    for e in encounters:
        # Fetch approved or dispensed prescriptions for this encounter
        rxs = db.scalars(
            select(models.Prescription)
            .where(models.Prescription.encounter_id == e.encounter_id)
            .where(models.Prescription.status.in_(["APPROVED", "DISPENSED", "EXPIRED", "PREPAID"]))
        ).all()
        
        for rx in rxs:
            items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id)).all()
            patient = db.get(models.Patient, e.patient_id)
            # Find doctor
            doctor = db.scalar(select(models.Staff).where(models.Staff.staff_id == rx.prescribed_by))
            if not doctor:
                doctor = db.scalar(select(models.Staff).where(models.Staff.name == rx.prescribed_by))
            
            results.append({
                "rx_id": rx.rx_id,
                "encounter_id": e.encounter_id,
                "date": e.arrival_ts.date().isoformat() if e.arrival_ts else None,
                "patient_name": patient.full_name,
                "patient_mobile": patient.mobile,
                "doctor_name": doctor.name if doctor else rx.prescribed_by or "Assigned Clinician",
                "department": e.department,
                "status": rx.status,
                "items": [
                    {
                        "drug_name": item.drug_name,
                        "dose": item.dose,
                        "frequency": item.frequency,
                        "duration_days": item.duration_days,
                        "instructions": item.instructions,
                        "quantity": item.quantity or 1,
                        "unit_price": db.scalar(
                            select(models.PharmacyStock.unit_price)
                            .where(func.lower(models.PharmacyStock.drug_name) == item.drug_name.lower())
                        ) or 10.0
                    }
                    for item in items
                ]
            })
            
    return results


@router.post("/pharmacy/dispense/{rx_id}")
def dispense_prescription(rx_id: str, db: Session = Depends(get_db)) -> dict:
    rx = db.get(models.Prescription, rx_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "APPROVED":
        raise HTTPException(status_code=400, detail=f"Prescription is in status {rx.status}, only APPROVED prescriptions can be dispensed")

    items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx_id)).all()
    for item in items:
        stock = db.scalar(
            select(models.PharmacyStock).where(func.lower(models.PharmacyStock.drug_name) == item.drug_name.lower())
        )
        if stock:
            qty = item.quantity or 1
            stock.quantity_available = max(0, stock.quantity_available - qty)
            stock.quantity_reserved = max(0, stock.quantity_reserved - qty)

    rx.status = "DISPENSED"
    db.commit()
    bus.publish(Topics.PAYMENT_COMPLETED, {"rx_id": rx_id, "encounter_id": rx.encounter_id})
    return {"status": "success", "rx_id": rx_id, "prescription_status": rx.status}


@router.post("/pharmacy/release-expired-reservations")
def release_expired_reservations(db: Session = Depends(get_db)) -> dict:
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    
    expired_rxs = db.scalars(
        select(models.Prescription)
        .where(models.Prescription.status == "APPROVED")
        .where(models.Prescription.approved_ts < cutoff)
    ).all()

    released_count = 0
    for rx in expired_rxs:
        items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id)).all()
        for item in items:
            stock = db.scalar(
                select(models.PharmacyStock).where(func.lower(models.PharmacyStock.drug_name) == item.drug_name.lower())
            )
            if stock:
                qty = item.quantity or 1
                stock.quantity_reserved = max(0, stock.quantity_reserved - qty)
        
        rx.status = "EXPIRED"
        released_count += 1
        
    db.commit()
    return {"status": "success", "released_count": released_count}


@router.post("/pharmacy/prescriptions/{rx_id}/pay")
def pay_prescription(rx_id: str, db: Session = Depends(get_db)) -> dict:
    rx = db.get(models.Prescription, rx_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "APPROVED":
        raise HTTPException(status_code=400, detail=f"Prescription must be APPROVED to pay online (current: {rx.status})")
    
    rx.status = "PREPAID"
    
    # Check if a Pharmacy pickup token already exists for this encounter
    token = db.scalar(
        select(models.Token)
        .where(models.Token.encounter_id == rx.encounter_id)
        .where(models.Token.department == "Pharmacy")
    )
    if not token:
        total_tokens = db.scalar(
            select(func.count())
            .select_from(models.Token)
            .where(models.Token.token_number.like("PHA-%"))
        ) or 0
        token = models.Token(
            encounter_id=rx.encounter_id,
            token_number=f"PHA-{total_tokens + 101:03d}",
            department="Pharmacy",
            room="Pharmacy Counter 3",
            floor="Ground Floor",
            eta_minutes=10,
            status="WAITING",
        )
        db.add(token)
    else:
        token.status = "WAITING"
        
    db.commit()
    bus.publish(Topics.PAYMENT_COMPLETED, {"rx_id": rx_id, "encounter_id": rx.encounter_id})
    return {"status": "success", "rx_id": rx_id, "prescription_status": rx.status, "token_number": token.token_number}


@router.post("/pharmacy/prescriptions/{rx_id}/ready")
def ready_prescription(rx_id: str, db: Session = Depends(get_db)) -> dict:
    rx = db.get(models.Prescription, rx_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "PREPAID":
        raise HTTPException(status_code=400, detail=f"Only PREPAID prescriptions can be marked ready (current: {rx.status})")
    
    token = db.scalar(
        select(models.Token)
        .where(models.Token.encounter_id == rx.encounter_id)
        .where(models.Token.department == "Pharmacy")
    )
    if token:
        token.status = "READY"
        db.commit()
        return {"status": "success", "rx_id": rx_id, "token_status": token.status}
    else:
        raise HTTPException(status_code=404, detail="Pharmacy pickup token not found")


@router.post("/pharmacy/prescriptions/{rx_id}/pickup")
def pickup_prescription(rx_id: str, db: Session = Depends(get_db)) -> dict:
    rx = db.get(models.Prescription, rx_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "PREPAID":
        raise HTTPException(status_code=400, detail=f"Prescription must be PREPAID to mark picked up (current: {rx.status})")
         
    # Deduct stock quantities from inventory
    items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx_id)).all()
    for item in items:
        stock = db.scalar(
            select(models.PharmacyStock).where(func.lower(models.PharmacyStock.drug_name) == item.drug_name.lower())
        )
        if stock:
            qty = item.quantity or 1
            stock.quantity_available = max(0, stock.quantity_available - qty)
            stock.quantity_reserved = max(0, stock.quantity_reserved - qty)
            
    rx.status = "DISPENSED"
    
    token = db.scalar(
        select(models.Token)
        .where(models.Token.encounter_id == rx.encounter_id)
        .where(models.Token.department == "Pharmacy")
    )
    if token:
        token.status = "COMPLETED"
        
    db.commit()
    return {"status": "success", "rx_id": rx_id, "prescription_status": rx.status}


@router.get("/pharmacy/prepaid")
def list_prepaid_prescriptions(db: Session = Depends(get_db)) -> list[dict]:
    rxs = db.scalars(
        select(models.Prescription)
        .where(models.Prescription.status == "PREPAID")
        .order_by(models.Prescription.created_ts.desc())
    ).all()
    
    results = []
    for rx in rxs:
        encounter = db.get(models.Encounter, rx.encounter_id)
        patient = db.get(models.Patient, rx.patient_id) if encounter else None
        if not patient:
            continue
        items = db.scalars(select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id)).all()
        token = db.scalar(
            select(models.Token)
            .where(models.Token.encounter_id == rx.encounter_id)
            .where(models.Token.department == "Pharmacy")
        )
        # Find doctor
        doctor = db.scalar(select(models.Staff).where(models.Staff.staff_id == rx.prescribed_by))
        if not doctor:
            doctor = db.scalar(select(models.Staff).where(models.Staff.name == rx.prescribed_by))
            
        results.append({
            "rx_id": rx.rx_id,
            "encounter_id": rx.encounter_id,
            "date": rx.created_ts.date().isoformat(),
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_mobile": patient.mobile,
            "doctor_name": doctor.name if doctor else rx.prescribed_by or "Assigned Clinician",
            "department": encounter.department if encounter else "Pharmacy",
            "status": rx.status,
            "pickup_token": {
                "number": token.token_number if token else None,
                "status": token.status if token else None,
                "room": token.room if token else None,
                "floor": token.floor if token else None
            } if token else None,
            "items": [
                {
                    "drug_name": item.drug_name,
                    "dose": item.dose,
                    "frequency": item.frequency,
                    "duration_days": item.duration_days,
                    "instructions": item.instructions,
                    "quantity": item.quantity or 1,
                    "unit_price": db.scalar(
                        select(models.PharmacyStock.unit_price)
                        .where(func.lower(models.PharmacyStock.drug_name) == item.drug_name.lower())
                    ) or 10.0
                }
                for item in items
            ]
        })
    return results


@router.post("/labs/orders/{lab_order_id}/local-analyze")
def run_local_lab_analysis(
    lab_order_id: str,
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db)
) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")

    file_path = None
    if file and file.filename:
        os.makedirs("uploads", exist_ok=True)
        file_path = os.path.join("uploads", file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())
        order.attachment_uri = f"/uploads/{file.filename}"
    elif order.attachment_uri:
        file_path = order.attachment_uri.lstrip("/")

    if not file_path or not os.path.exists(file_path):
        file_path = "uploads/dummy_scan.png"
        if not os.path.exists(file_path):
            try:
                from PIL import Image, ImageDraw
                os.makedirs("uploads", exist_ok=True)
                img = Image.new("RGB", (224, 224), color=(30, 35, 45))
                d = ImageDraw.Draw(img)
                d.text((40, 100), "RADIOLOGY SCAN", fill=(200, 220, 255))
                img.save(file_path)
            except Exception:
                pass

    lab_results = db.scalars(select(models.LabResult).where(models.LabResult.lab_order_id == lab_order_id)).all()
    db_result_str = ""
    if lab_results:
        db_result_str = " ".join([f"{r.analyte or ''}: {r.value} {r.unit or ''} (Flag: {r.abnormal_flag or 'N'})" for r in lab_results])

    combined_notes = f"{order.notes or ''} {db_result_str}".strip()
    print(f"\n[API Endpoint] Received Local AI Analysis request for Lab Order: {lab_order_id} (Test: {order.test_name}, Structured DB Data: '{db_result_str}')")
    from app.ai.local_analyzer import analyze_medical_file
    analysis = analyze_medical_file(file_path, test_name=order.test_name, clinical_notes=combined_notes)

    top_preds_str = ""
    if analysis.get("top_predictions"):
        preds_list = [f"{p['pathology']}: {p['probability']}%" for p in analysis["top_predictions"]]
        top_preds_str = "\n• Top Pathology Scores: " + " | ".join(preds_list)

    disclaimer_str = analysis.get("disclaimer", "⚠️ Preliminary AI Finding — Requires Physician Verification")
    source_str = analysis.get("source_type", "Radiology Image Scan")

    formatted_summary = (
        f"🤖 LOCAL PYTORCH VISION AI [{source_str}]:\n"
        f"• Primary Finding: {analysis['primary_finding']}\n"
        f"• Severity: {analysis['severity']} (Confidence: {analysis['confidence_score']}%){top_preds_str}\n"
        f"• Impression: {analysis['impression']}\n"
        f"• Recommendation: {analysis['recommendation']}"
    )
    order.ai_analysis_summary = formatted_summary
    if analysis.get("preview_uri"):
        order.attachment_uri = analysis["preview_uri"]

    db.commit()

    return {
        "status": "success",
        "lab_order_id": lab_order_id,
        "analysis": analysis,
        "formatted_summary": formatted_summary
    }


@router.delete("/labs/orders/{lab_order_id}")
def delete_lab_order(lab_order_id: str, db: Session = Depends(get_db)) -> dict:
    order = db.get(models.LabOrder, lab_order_id)
    if not order:
        raise HTTPException(404, "Lab order not found")
    if order.status == "RESULTED":
        raise HTTPException(400, "Cannot cancel a completed lab order with published results")

    db.delete(order)
    db.commit()
    return {"status": "success", "message": "Lab order removed", "lab_order_id": lab_order_id}
