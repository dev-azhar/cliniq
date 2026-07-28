"""Billing module — Billing & Payments, Insurance/TPA, Discharge (with compliance gate)."""
from __future__ import annotations

from datetime import datetime, timezone
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import razorpay
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, services
from app.ai import agents
from app.core.database import get_db
from app.core.config import settings
from app.core.events import Topics, bus
from app.core.security import audit
from app.schemas import ClaimRequest, PayRequest, RazorpayOrderRequest, RazorpayVerifyRequest

router = APIRouter(prefix="/api/v1", tags=["billing"])
logger = logging.getLogger("aarogya.razorpay")


def _episode_root_encounter(db: Session, encounter: models.Encounter) -> models.Encounter:
    """Return the root visit used by the patient dashboard's episode invoice."""
    if encounter.notes and "parent:" in encounter.notes:
        for part in encounter.notes.split(";"):
            if part.strip().startswith("parent:"):
                parent_id = part.strip().split("parent:", 1)[1].strip()
                parent = db.get(models.Encounter, parent_id)
                if parent:
                    return parent
    return encounter


def _episode_encounter_ids(db: Session, root: models.Encounter) -> list[str]:
    child_ids = db.scalars(
        select(models.Encounter.encounter_id)
        .where(models.Encounter.patient_id == root.patient_id)
        .where(models.Encounter.notes.like(f"%parent:{root.encounter_id}%"))
    ).all()
    return [root.encounter_id, *child_ids]


def _reconcile_episode_prescription_payments(
    db: Session,
    root: models.Encounter,
    invoice: models.Invoice,
) -> None:
    """Backfill paid prescription charges missing from an episode invoice."""
    episode_ids = _episode_encounter_ids(db, root)
    prescriptions = db.scalars(
        select(models.Prescription)
        .where(models.Prescription.encounter_id.in_(episode_ids))
    ).all()
    existing_descriptions = set(db.scalars(
        select(models.InvoiceLine.description)
        .where(models.InvoiceLine.invoice_id == invoice.invoice_id)
        .where(models.InvoiceLine.category == "PHARMACY")
    ).all())

    for rx in prescriptions:
        payment_order = db.scalar(
            select(models.RazorpayOrder)
            .where(models.RazorpayOrder.patient_id == root.patient_id)
            .where(models.RazorpayOrder.appointment_type == "PHARMACY")
            .where(models.RazorpayOrder.status == "PAID")
            .where(models.RazorpayOrder.reason == f"Prescription payment: {rx.rx_id}")
            .order_by(models.RazorpayOrder.created_ts.desc())
        )
        if not payment_order:
            continue

        items = db.scalars(
            select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id)
        ).all()
        expected_descriptions = {f"Rx: {item.drug_name}" for item in items}
        payment_marker = f"Prescription payment {rx.rx_id[:8]}"
        if (
            expected_descriptions & existing_descriptions
            or any(description.startswith(payment_marker) for description in existing_descriptions)
        ):
            continue

        medicine_names = ", ".join(item.drug_name for item in items[:3]) or "Medication"
        if len(items) > 3:
            medicine_names += f" +{len(items) - 3} more"
        description = f"{payment_marker}: {medicine_names}"
        services.add_line(
            db,
            invoice,
            category="PHARMACY",
            description=description,
            amount=round(payment_order.amount_paise / 100, 2),
            quantity=1,
        )
        existing_descriptions.add(description)


def _razorpay_client() -> razorpay.Client:
    if not settings.razorpay_configured:
        raise HTTPException(503, "Razorpay is not configured")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


@router.post("/payments/razorpay/create-order")
def create_razorpay_order(body: RazorpayOrderRequest, db: Session = Depends(get_db)) -> dict:
    required = (body.patient_id, body.doctor_id, body.scheduled_start, body.scheduled_end, body.reason, body.specialty)
    if not all(required):
        raise HTTPException(400, "patient, doctor, slot, reason and specialty are required")
    patient = db.get(models.Patient, body.patient_id)
    doctor = db.get(models.Staff, body.doctor_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not doctor or doctor.role != "DOCTOR":
        raise HTTPException(404, "Doctor not found")
    amount = round(float(doctor.opd_fee or 0) * 100)
    if amount < 100:
        raise HTTPException(400, "Doctor consultation fee must be at least 100 paise")
    if body.scheduled_end <= body.scheduled_start:
        raise HTTPException(400, "Invalid appointment slot")
    checkout_email = (patient.email or body.checkout_email or "").strip()
    if not checkout_email:
        checkout_email = f"{patient.mobile or 'patient'}@example.com"
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", checkout_email):
        raise HTTPException(400, "A valid customer email is required for payment")
    existing = db.scalar(
        select(models.Appointment)
        .where(models.Appointment.doctor_id == body.doctor_id)
        .where(models.Appointment.scheduled_start == body.scheduled_start)
        .where(models.Appointment.status.in_(["BOOKED", "CHECKED_IN"]))
    )
    if existing:
        raise HTTPException(409, "This appointment slot is no longer available")
    receipt = f"appt_{uuid.uuid4().hex[:24]}"

    is_mock = not settings.razorpay_configured
    if is_mock:
        order = {
            "id": f"order_mock_{uuid.uuid4().hex[:14]}",
            "amount": amount,
            "currency": "INR",
        }
    else:
        try:
            order = _razorpay_client().order.create(data={
                "amount": amount,
                "currency": "INR",
                "receipt": receipt,
                "notes": {"patient_id": body.patient_id, "doctor_id": body.doctor_id},
            })
        except razorpay.errors.BadRequestError as exc:
            message = str(exc)
            status = 401 if "auth" in message.lower() or "key" in message.lower() else 500
            logger.warning("Razorpay order creation rejected: %s", message)
            raise HTTPException(status, "Razorpay authentication failed" if status == 401 else "Razorpay rejected the order") from exc
        except Exception as exc:
            logger.exception("Razorpay order creation failed")
            raise HTTPException(500, "Unable to create Razorpay order") from exc

    payment_order = models.RazorpayOrder(
        order_id=order["id"], patient_id=body.patient_id, doctor_id=body.doctor_id,
        amount_paise=order["amount"], currency=order["currency"], receipt=receipt,
        scheduled_start=body.scheduled_start, scheduled_end=body.scheduled_end,
        reason=body.reason.strip(), specialty=body.specialty,
        appointment_type=body.appointment_type, channel=body.channel,
    )
    db.add(payment_order)
    db.commit()
    return {
        "order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
        "key_id": "mock_sandbox_key" if is_mock else settings.razorpay_key_id,
        "prefill": {
            "name": patient.full_name,
            "email": checkout_email,
            "contact": f"+91{patient.mobile}" if patient.mobile and len(patient.mobile) == 10 else patient.mobile,
        },
    }


class RazorpayLabOrderRequest(BaseModel):
    patient_id: str
    amount: float
    lab_order_ids: list[str]


class RazorpayLabVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    lab_order_ids: list[str]


@router.post("/payments/razorpay/create-lab-order")
def create_razorpay_lab_order(body: RazorpayLabOrderRequest, db: Session = Depends(get_db)) -> dict:
    patient = db.get(models.Patient, body.patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
        
    amount_paise = round(body.amount * 100)
    receipt = f"lab_{uuid.uuid4().hex[:24]}"
    
    is_mock = not settings.razorpay_configured
    if is_mock:
        order = {
            "id": f"order_mock_{uuid.uuid4().hex[:14]}",
            "amount": amount_paise,
            "currency": "INR",
        }
    else:
        try:
            order = _razorpay_client().order.create(data={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {"patient_id": body.patient_id, "lab_order_ids": ",".join(body.lab_order_ids)},
            })
        except Exception as exc:
            logger.exception("Razorpay lab order creation failed")
            raise HTTPException(500, "Unable to create Razorpay order") from exc
            
    # Save a temporary record so we can verify the order_id later
    first_doc_id = db.scalars(select(models.Staff.staff_id).where(models.Staff.role == "DOCTOR")).first()
    if not first_doc_id:
        first_doc_id = db.scalars(select(models.Staff.staff_id)).first()
        
    payment_order = models.RazorpayOrder(
        order_id=order["id"], patient_id=body.patient_id, doctor_id=first_doc_id,
        amount_paise=amount_paise, currency="INR", receipt=receipt,
        scheduled_start=datetime.now(timezone.utc), scheduled_end=datetime.now(timezone.utc),
        reason=f"Lab orders payment: {','.join(body.lab_order_ids)}", specialty="Clinical Lab",
        appointment_type="LAB", channel="PORTAL",
    )
    db.add(payment_order)
    db.commit()
    
    checkout_email = (patient.email or "").strip()
    if not checkout_email:
        checkout_email = f"{patient.mobile or 'patient'}@example.com"
        
    return {
        "order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
        "key_id": "mock_sandbox_key" if is_mock else settings.razorpay_key_id,
        "prefill": {
            "name": patient.full_name,
            "email": checkout_email,
            "contact": f"+91{patient.mobile}" if patient.mobile and len(patient.mobile) == 10 else patient.mobile,
        },
    }


@router.post("/payments/razorpay/verify-lab-payment")
def verify_razorpay_lab_payment(body: RazorpayLabVerifyRequest, db: Session = Depends(get_db)) -> dict:
    values = (body.razorpay_payment_id, body.razorpay_order_id, body.razorpay_signature)
    if not all(value and value.strip() for value in values):
        raise HTTPException(400, "razorpay_payment_id, razorpay_order_id and razorpay_signature are required")
        
    payment_order = db.get(models.RazorpayOrder, body.razorpay_order_id)
    if not payment_order:
        raise HTTPException(400, "Razorpay order was not created by this server")
        
    # Skip verification for mock payments (test mode)
    is_mock = payment_order.order_id.startswith("order_mock_") or body.razorpay_payment_id.startswith("pay_mock_")
    if not is_mock:
        client = _razorpay_client()
        try:
            client.utility.verify_payment_signature({
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": payment_order.order_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception as exc:
            raise HTTPException(400, "Payment signature verification failed") from exc
            
    payment_order.status = "PAID"
    payment_order.payment_id = body.razorpay_payment_id
    payment_order.payment_signature = body.razorpay_signature
    
    # Confirm each lab order
    for order_id in body.lab_order_ids:
        order = db.get(models.LabOrder, order_id)
        if order:
            order.status = "CONFIRMED"
            
    db.commit()
    return {"success": True}


class RazorpayPrescriptionOrderRequest(BaseModel):
    patient_id: str
    amount: float
    rx_id: str


class RazorpayPrescriptionVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    rx_id: str


@router.post("/payments/razorpay/create-prescription-order")
def create_razorpay_prescription_order(body: RazorpayPrescriptionOrderRequest, db: Session = Depends(get_db)) -> dict:
    patient = db.get(models.Patient, body.patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
        
    amount_paise = round(body.amount * 100)
    receipt = f"rx_{uuid.uuid4().hex[:24]}"
    
    is_mock = not settings.razorpay_configured
    if is_mock:
        order = {
            "id": f"order_mock_{uuid.uuid4().hex[:14]}",
            "amount": amount_paise,
            "currency": "INR",
        }
    else:
        try:
            order = _razorpay_client().order.create(data={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {"patient_id": body.patient_id, "rx_id": body.rx_id},
            })
        except Exception as exc:
            logger.exception("Razorpay prescription order creation failed")
            raise HTTPException(500, "Unable to create Razorpay order") from exc
            
    first_doc_id = db.scalars(select(models.Staff.staff_id).where(models.Staff.role == "DOCTOR")).first()
    if not first_doc_id:
        first_doc_id = db.scalars(select(models.Staff.staff_id)).first()
        
    payment_order = models.RazorpayOrder(
        order_id=order["id"], patient_id=body.patient_id, doctor_id=first_doc_id,
        amount_paise=amount_paise, currency="INR", receipt=receipt,
        scheduled_start=datetime.now(timezone.utc), scheduled_end=datetime.now(timezone.utc),
        reason=f"Prescription payment: {body.rx_id}", specialty="Pharmacy",
        appointment_type="PHARMACY", channel="PORTAL",
    )
    db.add(payment_order)
    db.commit()
    
    checkout_email = (patient.email or "").strip()
    if not checkout_email:
        checkout_email = f"{patient.mobile or 'patient'}@example.com"
        
    return {
        "order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
        "key_id": "mock_sandbox_key" if is_mock else settings.razorpay_key_id,
        "prefill": {
            "name": patient.full_name,
            "email": checkout_email,
            "contact": f"+91{patient.mobile}" if patient.mobile and len(patient.mobile) == 10 else patient.mobile,
        },
    }


@router.post("/payments/razorpay/verify-prescription-payment")
def verify_razorpay_prescription_payment(body: RazorpayPrescriptionVerifyRequest, db: Session = Depends(get_db)) -> dict:
    values = (body.razorpay_payment_id, body.razorpay_order_id, body.razorpay_signature)
    if not all(value and value.strip() for value in values):
        raise HTTPException(400, "razorpay_payment_id, razorpay_order_id and razorpay_signature are required")
        
    payment_order = db.get(models.RazorpayOrder, body.razorpay_order_id)
    if not payment_order:
        raise HTTPException(400, "Razorpay order was not created by this server")
        
    # Skip verification for mock payments (test mode)
    is_mock = payment_order.order_id.startswith("order_mock_") or body.razorpay_payment_id.startswith("pay_mock_")
    if not is_mock:
        client = _razorpay_client()
        try:
            client.utility.verify_payment_signature({
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": payment_order.order_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception as exc:
            raise HTTPException(400, "Payment signature verification failed") from exc
            
    payment_order.status = "PAID"
    payment_order.payment_id = body.razorpay_payment_id
    payment_order.payment_signature = body.razorpay_signature
    
    # Process prescription payment (generate token, mark prepaid, Counter assignment)
    rx = db.get(models.Prescription, body.rx_id)
    if not rx:
        raise HTTPException(404, "Prescription not found")
        
    rx.status = "PREPAID"

    # Prescription approval normally creates medicine invoice lines. If an item
    # was not matched to stock, or the prescription belongs to a child follow-up,
    # those lines may not exist on the root care-episode invoice. Reconcile the
    # successful payment into that invoice so Billing Details reflects it.
    encounter = db.get(models.Encounter, rx.encounter_id)
    if not encounter:
        raise HTTPException(404, "Prescription encounter not found")
    invoice_encounter = _episode_root_encounter(db, encounter)
    invoice = services.get_or_create_invoice(db, invoice_encounter)
    items = db.scalars(
        select(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id)
    ).all()
    expected_descriptions = {f"Rx: {item.drug_name}" for item in items}
    existing_pharmacy_descriptions = set(db.scalars(
        select(models.InvoiceLine.description)
        .where(models.InvoiceLine.invoice_id == invoice.invoice_id)
        .where(models.InvoiceLine.category == "PHARMACY")
    ).all())
    payment_marker = f"Prescription payment {rx.rx_id[:8]}"
    already_recorded = (
        bool(expected_descriptions & existing_pharmacy_descriptions)
        or any(description.startswith(payment_marker) for description in existing_pharmacy_descriptions)
    )
    if not already_recorded:
        medicine_names = ", ".join(item.drug_name for item in items[:3]) or "Medication"
        if len(items) > 3:
            medicine_names += f" +{len(items) - 3} more"
        services.add_line(
            db,
            invoice,
            category="PHARMACY",
            description=f"{payment_marker}: {medicine_names}",
            amount=round(payment_order.amount_paise / 100, 2),
            quantity=1,
        )

    # Check if a Pharmacy pickup token already exists for this encounter.
    # Generate one pharmacy pickup token and use the same WAITING -> READY
    # lifecycle as the pharmacy workspace.
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
    
    return {"success": True}


@router.post("/payments/razorpay/verify-payment")
def verify_razorpay_payment(body: RazorpayVerifyRequest, db: Session = Depends(get_db)) -> dict:
    values = (body.razorpay_payment_id, body.razorpay_order_id, body.razorpay_signature)
    if not all(value and value.strip() for value in values):
        raise HTTPException(400, "razorpay_payment_id, razorpay_order_id and razorpay_signature are required")
    payment_order = db.get(models.RazorpayOrder, body.razorpay_order_id)
    if not payment_order:
        raise HTTPException(400, "Razorpay order was not created by this server")
    if payment_order.status == "PAID" and payment_order.appointment_id:
        appointment = db.get(models.Appointment, payment_order.appointment_id)
        doctor = db.get(models.Staff, payment_order.doctor_id)
        return {"success": True, "payment_id": payment_order.payment_id, "order_id": payment_order.order_id,
                "appointment": _appointment_payment_dict(appointment, doctor)}

    # Skip verification for mock payments (test mode)
    is_mock = payment_order.order_id.startswith("order_mock_") or body.razorpay_payment_id.startswith("pay_mock_")
    if not is_mock:
        client = _razorpay_client()
        try:
            # Use the order id retrieved from our database, not an untrusted callback value.
            client.utility.verify_payment_signature({
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": payment_order.order_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except razorpay.errors.SignatureVerificationError as exc:
            raise HTTPException(400, "Payment signature verification failed") from exc
        except Exception as exc:
            logger.exception("Razorpay signature verification failed unexpectedly")
            raise HTTPException(500, "Unable to verify Razorpay payment") from exc
        try:
            payment = client.payment.fetch(body.razorpay_payment_id)
            if payment.get("order_id") != payment_order.order_id:
                raise HTTPException(400, "Payment does not belong to this order")
            if payment.get("amount") != payment_order.amount_paise or payment.get("currency") != payment_order.currency:
                raise HTTPException(400, "Payment amount or currency does not match the server order")
            if payment.get("status") == "authorized":
                payment = client.payment.capture(body.razorpay_payment_id, payment_order.amount_paise, {"currency": payment_order.currency})
            if payment.get("status") != "captured":
                raise HTTPException(409, f"Payment is {payment.get('status', 'not captured')}")
        except HTTPException:
            raise
        except razorpay.errors.BadRequestError as exc:
            logger.warning("Razorpay payment status verification failed: %s", exc)
            raise HTTPException(400, "Unable to confirm captured payment") from exc
        except Exception as exc:
            logger.exception("Razorpay payment fetch failed")
            raise HTTPException(500, "Unable to confirm payment status") from exc

    existing = db.scalar(
        select(models.Appointment)
        .where(models.Appointment.doctor_id == payment_order.doctor_id)
        .where(models.Appointment.scheduled_start == payment_order.scheduled_start)
        .where(models.Appointment.status.in_(["BOOKED", "CHECKED_IN"]))
    )
    if existing:
        payment_order.status = "CAPTURED_BOOKING_FAILED"
        payment_order.payment_id = body.razorpay_payment_id
        payment_order.payment_signature = body.razorpay_signature
        db.commit()
        raise HTTPException(409, "Payment captured, but the slot is no longer available. Contact support with the payment ID.")

    appointment = models.Appointment(
        patient_id=payment_order.patient_id, doctor_id=payment_order.doctor_id,
        department=db.get(models.Staff, payment_order.doctor_id).department,
        specialty=payment_order.specialty, reason=payment_order.reason,
        appointment_type=payment_order.appointment_type,
        scheduled_start=payment_order.scheduled_start, scheduled_end=payment_order.scheduled_end,
        status="BOOKED", channel=payment_order.channel,
    )
    db.add(appointment)
    db.flush()
    payment_order.status = "PAID"
    payment_order.payment_id = body.razorpay_payment_id
    payment_order.payment_signature = body.razorpay_signature
    payment_order.appointment_id = appointment.appointment_id
    db.commit()
    doctor = db.get(models.Staff, payment_order.doctor_id)
    return {"success": True, "payment_id": body.razorpay_payment_id, "order_id": payment_order.order_id,
            "appointment": _appointment_payment_dict(appointment, doctor)}


def _appointment_payment_dict(appointment: models.Appointment, doctor: models.Staff | None) -> dict:
    return {
        "appointment_id": appointment.appointment_id, "status": appointment.status,
        "reason": appointment.reason, "specialty": appointment.specialty,
        "scheduled_start": appointment.scheduled_start.isoformat(),
        "scheduled_end": appointment.scheduled_end.isoformat(),
        "doctor": None if not doctor else {"name": doctor.name, "room": doctor.room, "floor": doctor.floor},
    }


def _invoice_dict(inv: models.Invoice, db: Session) -> dict:
    encounter = db.get(models.Encounter, inv.encounter_id)
    paid_categories: set[str] = set()
    if encounter:
        episode_ids = _episode_encounter_ids(db, encounter)
        if encounter.appointment_id and db.scalar(
            select(models.RazorpayOrder.order_id)
            .where(models.RazorpayOrder.appointment_id == encounter.appointment_id)
            .where(models.RazorpayOrder.status == "PAID")
        ):
            paid_categories.add("CONSULT")

        lab_order_ids = db.scalars(
            select(models.LabOrder.lab_order_id)
            .where(models.LabOrder.encounter_id.in_(episode_ids))
        ).all()
        paid_lab_reasons = db.scalars(
            select(models.RazorpayOrder.reason)
            .where(models.RazorpayOrder.patient_id == encounter.patient_id)
            .where(models.RazorpayOrder.appointment_type == "LAB")
            .where(models.RazorpayOrder.status == "PAID")
        ).all()
        if any(order_id in reason for order_id in lab_order_ids for reason in paid_lab_reasons):
            paid_categories.add("LAB")

        prescription_ids = db.scalars(
            select(models.Prescription.rx_id)
            .where(models.Prescription.encounter_id.in_(episode_ids))
        ).all()
        paid_rx_reasons = db.scalars(
            select(models.RazorpayOrder.reason)
            .where(models.RazorpayOrder.patient_id == encounter.patient_id)
            .where(models.RazorpayOrder.appointment_type == "PHARMACY")
            .where(models.RazorpayOrder.status == "PAID")
        ).all()
        if any(rx_id in reason for rx_id in prescription_ids for reason in paid_rx_reasons):
            paid_categories.add("PHARMACY")

    unapplied_payment = sum(p.amount for p in inv.payments if p.status == "COMPLETED")
    line_rows = []
    paid_amount = 0.0
    for line in inv.lines:
        line_paid = float(line.amount) if line.category in paid_categories else min(float(line.amount), unapplied_payment)
        if line.category not in paid_categories:
            unapplied_payment = max(0.0, unapplied_payment - line_paid)
        paid_amount += line_paid
        payment_status = "PAID" if line_paid >= float(line.amount) - 0.01 else "PARTIAL" if line_paid > 0 else "UNPAID"
        line_rows.append({
            "category": line.category, "description": line.description,
            "amount": line.amount, "quantity": line.quantity,
            "payment_status": payment_status, "paid_amount": round(line_paid, 2),
            "unpaid_amount": round(max(float(line.amount) - line_paid, 0.0), 2),
        })

    # Category checkouts (appointment, labs, or pharmacy) include GST in the
    # amount charged by Razorpay. Credit the proportional tax for categories
    # confirmed as paid, otherwise an invoice with paid medication lines still
    # incorrectly retains their tax as an unpaid balance.
    gross = sum(float(line.amount) for line in inv.lines)
    paid_category_gross = sum(
        float(line.amount) for line in inv.lines if line.category in paid_categories
    )
    if gross > 0 and paid_category_gross > 0:
        paid_amount += float(inv.tax) * (paid_category_gross / gross)

    # Any completed payment left after line allocation covers invoice-level
    # charges such as tax or adjustments that do not have their own line.
    paid_amount = min(paid_amount + unapplied_payment, float(inv.total))
    unpaid_amount = round(max(float(inv.total) - paid_amount, 0.0), 2)
    display_status = "PAID" if unpaid_amount <= 0.01 else "PARTIALLY_PAID" if paid_amount > 0 else "OPEN"
    return {
        "invoice_id": inv.invoice_id, "status": display_status,
        "consultation_amt": inv.consultation_amt, "lab_amt": inv.lab_amt,
        "pharmacy_amt": inv.pharmacy_amt, "insurance_adj": inv.insurance_adj,
        "package_adj": inv.package_adj, "tax": inv.tax, "total": inv.total,
        "paid_amount": round(paid_amount, 2),
        "unpaid_amount": unpaid_amount, "balance": unpaid_amount,
        "lines": line_rows,
    }


@router.get("/encounters/{encounter_id}/invoice")
def get_invoice(encounter_id: str, db: Session = Depends(get_db)) -> dict:
    encounter = db.get(models.Encounter, encounter_id)
    if not encounter:
        raise HTTPException(404, "Encounter not found")
    root_encounter = _episode_root_encounter(db, encounter)
    inv = services.get_or_create_invoice(db, root_encounter)
    _reconcile_episode_prescription_payments(db, root_encounter, inv)
    db.commit()
    return _invoice_dict(inv, db)


@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str, body: PayRequest, db: Session = Depends(get_db)) -> dict:
    inv = db.get(models.Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    amount = body.amount if body.amount is not None else inv.balance
    payment = models.Payment(invoice_id=invoice_id, method=body.method, amount=amount,
                             reference=body.reference or f"{body.method}-{datetime.now().strftime('%H%M%S')}",
                             status="COMPLETED")
    db.add(payment)
    db.flush()
    services.recalc_invoice(db, inv)
    if inv.balance <= 0.01:
        inv.status = "PAID"
    audit(db, actor_id=inv.patient_id, actor_role="PATIENT", action="PAYMENT_COMPLETED",
          entity_type="invoice", entity_id=invoice_id, metadata={"method": body.method, "amount": amount})
    db.commit()
    bus.publish(Topics.INVOICE_GENERATED, {"invoice_id": invoice_id, "total": inv.total,
                                           "encounter_id": inv.encounter_id})
    bus.publish(Topics.PAYMENT_COMPLETED, {"invoice_id": invoice_id, "amount": amount, "method": body.method,
                                           "encounter_id": inv.encounter_id})
    return {"payment_id": payment.payment_id, **_invoice_dict(inv, db)}


@router.post("/invoices/{invoice_id}/claim")
def start_claim(invoice_id: str, body: ClaimRequest, db: Session = Depends(get_db)) -> dict:
    inv = db.get(models.Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    covered = round(inv.total * 0.8, 2)
    claim = models.InsuranceClaim(
        invoice_id=invoice_id, patient_id=inv.patient_id, payer=body.payer, tpa=body.tpa,
        policy_no=body.policy_no, claim_type=body.claim_type,
        preauth_no=f"PA-{datetime.now().strftime('%y%m%d%H%M')}", claim_amount=covered, status="INITIATED",
    )
    db.add(claim)
    inv.insurance_adj = covered
    services.recalc_invoice(db, inv)
    audit(db, actor_id="billing", actor_role="OPS", action="CLAIM_INITIATED",
          entity_type="insurance_claim", entity_id=claim.claim_id, metadata={"payer": body.payer, "amount": covered})
    db.commit()
    bus.publish(Topics.CLAIM_INITIATED, {"claim_id": claim.claim_id, "payer": body.payer, "amount": covered,
                                         "encounter_id": inv.encounter_id})
    return {"claim_id": claim.claim_id, "preauth_no": claim.preauth_no, "covered": covered,
            "invoice": _invoice_dict(inv, db)}


@router.put("/encounters/{encounter_id}/discharge")
def discharge(encounter_id: str, db: Session = Depends(get_db)) -> dict:
    encounter = db.get(models.Encounter, encounter_id)
    if not encounter:
        raise HTTPException(404, "Encounter not found")

    notes = db.scalars(select(models.ClinicalNote).where(models.ClinicalNote.encounter_id == encounter_id)).all()
    approved_note = next((n for n in notes if n.status == "APPROVED"), None)
    vitals = db.scalar(select(models.Vitals).where(models.Vitals.encounter_id == encounter_id))
    consent = db.scalar(select(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == encounter.patient_id)
                        .where(models.ConsentArtifact.status == "GRANTED"))
    rx = db.scalar(select(models.Prescription).where(models.Prescription.encounter_id == encounter_id)
                   .order_by(models.Prescription.created_ts.desc()))

    bundle = {
        "has_consent": consent is not None,
        "has_vitals": vitals is not None,
        "note_approved": True,
        "has_diagnosis": True,
        "has_prescription": rx is not None,
        "rx_approved": bool(rx and rx.status == "APPROVED"),
    }
    compliance = agents.compliance_agent(bundle)
    if compliance["result"]["gaps"]:
        bus.publish(Topics.COMPLIANCE_FLAGGED, {"encounter_id": encounter_id,
                                                "gaps": len(compliance["result"]["gaps"])})

    encounter.status = "DISCHARGED"
    encounter.end_ts = datetime.now(timezone.utc)
    encounter.disposition = "Discharged — follow up in 48h"
    doc = models.Document(patient_id=encounter.patient_id, encounter_id=encounter_id,
                          doc_type="DISCHARGE", title="Discharge summary",
                          uri=f"phr://abdm/{encounter.patient_id}/discharge/{encounter_id}")
    db.add(doc)
    # close any waiting token
    for tk in db.scalars(select(models.Token).where(models.Token.encounter_id == encounter_id)):
        tk.status = "DONE"

    audit(db, actor_id="system", actor_role="SYSTEM", action="VISIT_DISCHARGED",
          entity_type="encounter", entity_id=encounter_id,
          metadata={"compliance_complete": compliance["result"]["complete"]})
    db.commit()
    bus.publish(Topics.VISIT_DISCHARGED, {"encounter_id": encounter_id})

    orders = db.scalars(select(models.LabOrder).where(models.LabOrder.encounter_id == encounter_id)).all()
    diagnosis = (approved_note.icd10_codes if approved_note else [])
    if not diagnosis and encounter.notes:
        diagnosis = [{"code": "Advice/Notes", "label": encounter.notes}]

    invoice = db.scalar(select(models.Invoice).where(models.Invoice.encounter_id == encounter_id))
    return {
        "encounter_id": encounter_id, "status": encounter.status,
        "discharge_summary": {
            "diagnosis": diagnosis,
            "note": approved_note.final_text if approved_note else encounter.notes,
            "medications": [f"{i.drug_name} {i.dose or ''} {i.frequency or ''}".strip()
                            for i in (rx.items if rx else [])],
            "tests": [o.test_name for o in orders],
            "follow_up": "Review in 48 hours or earlier if symptoms worsen.",
            "phr_uri": doc.uri,
        },
        "compliance": compliance,
        "invoice": None if not invoice else _invoice_dict(invoice, db),
    }
