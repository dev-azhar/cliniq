"""FHIR-aligned domain model.

One module per convenience, but each block maps to a service that *owns* that data in the
microservices catalog. UUID string PKs + JSON columns keep this portable across SQLite (zero-setup
dev) and PostgreSQL (prod).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- Identity & Registration
class Patient(Base):
    __tablename__ = "patient"

    patient_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    abha_number: Mapped[str | None] = mapped_column(String(20), unique=True)
    abha_address: Mapped[str | None] = mapped_column(String(60))
    mrn: Mapped[str | None] = mapped_column(String(30), unique=True)
    empi_id: Mapped[str | None] = mapped_column(String(40))
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    dob: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))
    mobile: Mapped[str | None] = mapped_column(String(15))
    email: Mapped[str | None] = mapped_column(String(120))
    blood_group: Mapped[str | None] = mapped_column(String(5))
    address: Mapped[str | None] = mapped_column(String(240))
    profile_photo: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    allergies: Mapped[list["Allergy"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    issues: Mapped[list["PatientIssue"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    medications: Mapped[list["PatientMedication"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient")

    @property
    def full_name(self) -> str:
        return " ".join(filter(None, [self.first_name, self.last_name]))

    @property
    def age(self) -> int | None:
        if not self.dob:
            return None
        today = date.today()
        return today.year - self.dob.year - ((today.month, today.day) < (self.dob.month, self.dob.day))


class Allergy(Base):
    __tablename__ = "allergy"

    allergy_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    substance: Mapped[str] = mapped_column(String(120))
    drug_class: Mapped[str | None] = mapped_column(String(60))
    severity: Mapped[str | None] = mapped_column(String(20))  # MILD / MODERATE / SEVERE
    reaction: Mapped[str | None] = mapped_column(String(120))

    patient: Mapped["Patient"] = relationship(back_populates="allergies")


class PatientIssue(Base):
    __tablename__ = "patient_issue"

    issue_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id", ondelete="CASCADE"), nullable=False)
    issue_name: Mapped[str] = mapped_column(String(120), nullable=False)
    onset_info: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE / RESOLVED
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="issues")


class PatientMedication(Base):
    __tablename__ = "patient_medication"

    medication_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id", ondelete="CASCADE"), nullable=False)
    drug_name: Mapped[str] = mapped_column(String(120), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="medications")


class ConsentArtifact(Base):
    __tablename__ = "consent_artifact"

    consent_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    purpose: Mapped[str] = mapped_column(String(60))  # CARE_MGMT / BILLING ...
    hip_id: Mapped[str | None] = mapped_column(String(60))
    hiu_id: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20), default="GRANTED")  # GRANTED/REVOKED/EXPIRED
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Staff(Base):
    __tablename__ = "staff"

    staff_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    hpr_id: Mapped[str | None] = mapped_column(String(40))  # ABDM Healthcare Professionals Registry
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40))  # DOCTOR / NURSE / PHARMACIST / OPS
    department: Mapped[str | None] = mapped_column(String(60))
    specialty: Mapped[str | None] = mapped_column(String(60))
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # EMR details
    experience_years: Mapped[int | None] = mapped_column(Integer)
    room: Mapped[str | None] = mapped_column(String(20))
    floor: Mapped[str | None] = mapped_column(String(20))
    access_pin: Mapped[str | None] = mapped_column(String(40))
    opd_fee: Mapped[float | None] = mapped_column(Float, default=500.0)


# ------------------------------------------------------------------------------- Encounter & Clinical
class Encounter(Base):
    __tablename__ = "encounter"

    encounter_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    # Stored on the encounter for direct lookup. The reciprocal
    # Appointment.encounter_id owns the physical FK so DROP/CREATE has no cycle.
    appointment_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    visit_type: Mapped[str] = mapped_column(String(20), default="OPD")  # OPD / FOLLOWUP
    department: Mapped[str | None] = mapped_column(String(60))
    doctor_id: Mapped[str | None] = mapped_column(String(36))
    channel: Mapped[str | None] = mapped_column(String(20))  # WHATSAPP / KIOSK / APP / WALKIN
    status: Mapped[str] = mapped_column(String(24), default="CHECKED_IN")
    arrival_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    start_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disposition: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)

    patient: Mapped["Patient"] = relationship(back_populates="encounters")


class Appointment(Base):
    __tablename__ = "appointment"

    appointment_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    doctor_id: Mapped[str | None] = mapped_column(ForeignKey("staff.staff_id"))
    department: Mapped[str | None] = mapped_column(String(60))
    specialty: Mapped[str | None] = mapped_column(String(60))
    reason: Mapped[str | None] = mapped_column(Text)
    appointment_type: Mapped[str] = mapped_column(String(20), default="OPD")
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), default="BOOKED") #CANCELLED, RESCHEDULED, CHECKED_IN, COMPLETED
    channel: Mapped[str | None] = mapped_column(String(20))
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounter.encounter_id"))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class Vitals(Base):
    __tablename__ = "vitals"

    vital_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    bp_systolic: Mapped[int | None] = mapped_column(Integer)
    bp_diastolic: Mapped[int | None] = mapped_column(Integer)
    spo2: Mapped[int | None] = mapped_column(Integer)
    heart_rate: Mapped[int | None] = mapped_column(Integer)
    respiratory_rate: Mapped[int | None] = mapped_column(Integer)
    temperature: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    height_cm: Mapped[float | None] = mapped_column(Float)
    bmi: Mapped[float | None] = mapped_column(Float)
    captured_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Triage(Base):
    __tablename__ = "triage"

    triage_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    symptom_summary: Mapped[str | None] = mapped_column(Text)
    acuity_level: Mapped[str | None] = mapped_column(String(10))  # ESI 1..5
    specialty: Mapped[str | None] = mapped_column(String(60))
    recommended_doctor_id: Mapped[str | None] = mapped_column(String(36))
    red_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    red_flag_reason: Mapped[str | None] = mapped_column(String(200))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Token(Base):
    __tablename__ = "token"

    token_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    token_number: Mapped[str] = mapped_column(String(12))
    department: Mapped[str | None] = mapped_column(String(60))
    room: Mapped[str | None] = mapped_column(String(20))
    floor: Mapped[str | None] = mapped_column(String(20))
    eta_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="WAITING")
    issued_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ClinicalNote(Base):
    __tablename__ = "clinical_note"

    note_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    note_type: Mapped[str] = mapped_column(String(20), default="SOAP")
    ai_draft: Mapped[str | None] = mapped_column(Text)  # original AI output (retained for audit)
    final_text: Mapped[str | None] = mapped_column(Text)  # clinician-approved
    icd10_codes: Mapped[list | None] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT / APPROVED
    authored_by: Mapped[str | None] = mapped_column(String(36))
    approved_by: Mapped[str | None] = mapped_column(String(36))
    approved_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class EncounterAuditLog(Base):
    __tablename__ = "encounter_audit_log"

    audit_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    field_name: Mapped[str] = mapped_column(String(60))  # chief_complaint / symptom_summary / vitals
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    edited_by_role: Mapped[str] = mapped_column(String(40))  # PATIENT / NURSE / DOCTOR
    edited_by_user: Mapped[str | None] = mapped_column(String(120))  # Staff Name/ID or Patient Name
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)



# ------------------------------------------------------------------------ Orders, Results, Rx
class LabOrder(Base):
    __tablename__ = "lab_order"

    lab_order_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    test_code: Mapped[str | None] = mapped_column(String(20))  # LOINC
    test_name: Mapped[str | None] = mapped_column(String(120))
    panel: Mapped[str | None] = mapped_column(String(80))
    priority: Mapped[str] = mapped_column(String(10), default="ROUTINE")
    status: Mapped[str] = mapped_column(String(20), default="CREATED")
    ordered_by: Mapped[str | None] = mapped_column(String(36))
    qr_code: Mapped[str | None] = mapped_column(String(64), unique=True)
    price: Mapped[float | None] = mapped_column(Float)
    ordered_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    sample_collected_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    
    # Lab findings & attachments
    notes: Mapped[str | None] = mapped_column(Text) # Human technician notes
    ai_analysis_summary: Mapped[str | None] = mapped_column(Text) # Doctor-only PyTorch AI findings
    attachment_name: Mapped[str | None] = mapped_column(String(160))
    attachment_uri: Mapped[str | None] = mapped_column(String(300))


class LabResult(Base):
    __tablename__ = "lab_result"

    result_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    lab_order_id: Mapped[str] = mapped_column(ForeignKey("lab_order.lab_order_id"))
    test_code: Mapped[str | None] = mapped_column(String(20))
    analyte: Mapped[str | None] = mapped_column(String(60))
    value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(20))
    reference_low: Mapped[float | None] = mapped_column(Float)
    reference_high: Mapped[float | None] = mapped_column(Float)
    abnormal_flag: Mapped[str | None] = mapped_column(String(4))  # H / L / HH / LL / N
    status: Mapped[str] = mapped_column(String(20), default="FINAL")
    resulted_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Prescription(Base):
    __tablename__ = "prescription"

    rx_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT / APPROVED
    prescribed_by: Mapped[str | None] = mapped_column(String(36))
    approved_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    items: Mapped[list["PrescriptionItem"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan"
    )


class PrescriptionItem(Base):
    __tablename__ = "prescription_item"

    rx_item_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    rx_id: Mapped[str] = mapped_column(ForeignKey("prescription.rx_id"))
    drug_code: Mapped[str | None] = mapped_column(String(30))
    drug_name: Mapped[str] = mapped_column(String(120))
    drug_class: Mapped[str | None] = mapped_column(String(60))
    dose: Mapped[str | None] = mapped_column(String(40))
    route: Mapped[str | None] = mapped_column(String(20))
    frequency: Mapped[str | None] = mapped_column(String(30))
    duration_days: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[int | None] = mapped_column(Integer)
    substituted_from: Mapped[str | None] = mapped_column(String(120))
    instructions: Mapped[str | None] = mapped_column(String(200))

    prescription: Mapped["Prescription"] = relationship(back_populates="items")


class PharmacyStock(Base):
    __tablename__ = "pharmacy_stock"

    stock_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    drug_code: Mapped[str | None] = mapped_column(String(30))
    drug_name: Mapped[str] = mapped_column(String(120))
    drug_class: Mapped[str | None] = mapped_column(String(60))
    salt: Mapped[str | None] = mapped_column(String(120))
    batch: Mapped[str | None] = mapped_column(String(40))
    quantity_available: Mapped[int] = mapped_column(Integer, default=0)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[float | None] = mapped_column(Float)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(40))
    formulary: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# --------------------------------------------------------------------------------- Billing & Insurance
class RazorpayOrder(Base):
    __tablename__ = "razorpay_order"

    order_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    doctor_id: Mapped[str] = mapped_column(ForeignKey("staff.staff_id"))
    amount_paise: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    receipt: Mapped[str] = mapped_column(String(40), unique=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text)
    specialty: Mapped[str] = mapped_column(String(60))
    appointment_type: Mapped[str] = mapped_column(String(20), default="OPD")
    channel: Mapped[str] = mapped_column(String(20), default="PORTAL")
    status: Mapped[str] = mapped_column(String(24), default="CREATED")
    payment_id: Mapped[str | None] = mapped_column(String(60), unique=True)
    payment_signature: Mapped[str | None] = mapped_column(String(128))
    appointment_id: Mapped[str | None] = mapped_column(ForeignKey("appointment.appointment_id"))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class Invoice(Base):
    __tablename__ = "invoice"

    invoice_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounter.encounter_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    consultation_amt: Mapped[float] = mapped_column(Float, default=0.0)
    lab_amt: Mapped[float] = mapped_column(Float, default=0.0)
    pharmacy_amt: Mapped[float] = mapped_column(Float, default=0.0)
    package_adj: Mapped[float] = mapped_column(Float, default=0.0)
    insurance_adj: Mapped[float] = mapped_column(Float, default=0.0)
    tax: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")


class InvoiceLine(Base):
    __tablename__ = "invoice_line"

    line_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoice.invoice_id"))
    category: Mapped[str] = mapped_column(String(30))  # CONSULT / LAB / PHARMACY / PACKAGE
    description: Mapped[str] = mapped_column(String(160))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    amount: Mapped[float] = mapped_column(Float, default=0.0)

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class Payment(Base):
    __tablename__ = "payment"

    payment_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoice.invoice_id"))
    method: Mapped[str] = mapped_column(String(20))  # UPI / CARD / CASH / WALLET
    amount: Mapped[float] = mapped_column(Float)
    reference: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    paid_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class InsuranceClaim(Base):
    __tablename__ = "insurance_claim"

    claim_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoice.invoice_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    payer: Mapped[str | None] = mapped_column(String(80))
    tpa: Mapped[str | None] = mapped_column(String(80))
    policy_no: Mapped[str | None] = mapped_column(String(60))
    claim_type: Mapped[str | None] = mapped_column(String(20))  # CASHLESS / REIMBURSEMENT
    preauth_no: Mapped[str | None] = mapped_column(String(60))
    claim_amount: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default="INITIATED")
    submitted_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Document(Base):
    __tablename__ = "document"

    document_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    encounter_id: Mapped[str | None] = mapped_column(String(36))
    doc_type: Mapped[str] = mapped_column(String(40))  # LAB_REPORT / DISCHARGE / SCAN / AUDIO
    title: Mapped[str | None] = mapped_column(String(160))
    # Data URL containing the uploaded file bytes for this demo implementation.
    uri: Mapped[str | None] = mapped_column(Text)
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ------------------------------------------------------------------------------------- Inventory / Supply chain
class Supplier(Base):
    __tablename__ = "supplier"

    supplier_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    on_time_pct: Mapped[float] = mapped_column(Float, default=95.0)
    quality_score: Mapped[float] = mapped_column(Float, default=4.5)
    fill_rate: Mapped[float] = mapped_column(Float, default=95.0)
    rating: Mapped[int] = mapped_column(Integer, default=4)


class InventoryItem(Base):
    __tablename__ = "inventory_item"

    item_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(40))  # Pharmaceutical / Medical Consumable / Surgical / Equipment / Other
    unit: Mapped[str] = mapped_column(String(20))
    store: Mapped[str] = mapped_column(String(40), default="Central Store")
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    min_level: Mapped[int] = mapped_column(Integer, default=0)
    max_level: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    batch_no: Mapped[str | None] = mapped_column(String(40))
    expiry_date: Mapped[date | None] = mapped_column(Date)
    consumed_month: Mapped[int] = mapped_column(Integer, default=0)
    non_moving: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"

    po_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    po_number: Mapped[str] = mapped_column(String(30))
    supplier: Mapped[str] = mapped_column(String(120))
    order_date: Mapped[date] = mapped_column(Date, default=date.today)
    status: Mapped[str] = mapped_column(String(24), default="Ordered")  # Ordered / Approved / Partially Received / Delivered
    value: Mapped[float] = mapped_column(Float, default=0.0)


# ------------------------------------------------------------------------------------- Surgery / OT
class Surgery(Base):
    __tablename__ = "surgery"

    surgery_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    or_room: Mapped[str] = mapped_column(String(12))  # "OR 1" .. "OR 5"
    patient_name: Mapped[str] = mapped_column(String(120))
    mrn: Mapped[str | None] = mapped_column(String(30))
    procedure: Mapped[str] = mapped_column(String(160))
    surgeon: Mapped[str] = mapped_column(String(120))
    surgeon_role: Mapped[str | None] = mapped_column(String(60))
    anesthetist: Mapped[str | None] = mapped_column(String(120))
    anesthesia_type: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(24), default="Scheduled")  # Scheduled / In Pre-Op / In Progress / Post-Op / Completed / Cancelled
    priority: Mapped[str] = mapped_column(String(20), default="Routine")  # Routine / High / Emergency
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    duration_min: Mapped[int] = mapped_column(Integer, default=60)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)


# ------------------------------------------------------------------------------------- Audit (immutable)
class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str | None] = mapped_column(String(36))
    actor_role: Mapped[str | None] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str | None] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(36))
    consent_id: Mapped[str | None] = mapped_column(String(36))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    audit_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    event_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedule"

    schedule_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    doctor_id: Mapped[str] = mapped_column(ForeignKey("staff.staff_id"))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0 = Monday, 6 = Sunday
    start_time: Mapped[str] = mapped_column(String(5))  # "09:00"
    end_time: Mapped[str] = mapped_column(String(5))  # "13:00"
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=15)
    department: Mapped[str | None] = mapped_column(String(60))
    location: Mapped[str | None] = mapped_column(String(120))
    room: Mapped[str | None] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LabSchedule(Base):
    __tablename__ = "lab_schedule"

    schedule_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    category: Mapped[str] = mapped_column(String(60), default="ALL")  # PATHOLOGY, RADIOLOGY, CARDIOLOGY, ALL
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0 = Monday, 6 = Sunday
    start_time: Mapped[str] = mapped_column(String(5), default="08:00")
    end_time: Mapped[str] = mapped_column(String(5), default="18:00")
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=20)
    max_capacity_per_slot: Mapped[int] = mapped_column(Integer, default=5)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


# --------------------------------------------------------------------------------- Oncology / Cancer Care
class Diagnosis(Base):
    """A cancer diagnosis for a patient — primary site, histology and staging."""

    __tablename__ = "diagnosis"

    diagnosis_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounter.encounter_id"))
    cancer_type: Mapped[str] = mapped_column(String(120))  # e.g. "Breast", "Lung (NSCLC)"
    primary_site: Mapped[str | None] = mapped_column(String(120))
    histology: Mapped[str | None] = mapped_column(String(160))  # e.g. "Invasive ductal carcinoma"
    icd10_code: Mapped[str | None] = mapped_column(String(10))
    icdo_morphology_code: Mapped[str | None] = mapped_column(String(20))  # ICD-O-3 morphology
    grade: Mapped[str | None] = mapped_column(String(20))  # G1-G4 / Low / High
    stage_group: Mapped[str | None] = mapped_column(String(10))  # e.g. "Stage IIB"
    tnm_t: Mapped[str | None] = mapped_column(String(10))
    tnm_n: Mapped[str | None] = mapped_column(String(10))
    tnm_m: Mapped[str | None] = mapped_column(String(10))
    metastatic: Mapped[bool] = mapped_column(Boolean, default=False)
    metastatic_sites: Mapped[list | None] = mapped_column(JSON, default=list)
    diagnosed_by: Mapped[str | None] = mapped_column(String(36))
    diagnosed_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE / REMISSION / RECURRENT / RESOLVED
    notes: Mapped[str | None] = mapped_column(Text)
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    biomarkers: Mapped[list["BiomarkerTest"]] = relationship(back_populates="diagnosis", cascade="all, delete-orphan")
    chemo_regimens: Mapped[list["ChemoRegimen"]] = relationship(back_populates="diagnosis", cascade="all, delete-orphan")
    tumor_board_cases: Mapped[list["TumorBoardCase"]] = relationship(back_populates="diagnosis", cascade="all, delete-orphan")


class BiomarkerTest(Base):
    """Molecular / genetic biomarker result (e.g. ER/PR/HER2, EGFR, ALK, PD-L1, BRCA1/2)."""

    __tablename__ = "biomarker_test"

    biomarker_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    diagnosis_id: Mapped[str] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    marker_name: Mapped[str] = mapped_column(String(60))  # ER / PR / HER2 / EGFR / ALK / PD-L1 / BRCA1 ...
    result: Mapped[str | None] = mapped_column(String(60))  # POSITIVE / NEGATIVE / MUTATED / VUS / value
    value: Mapped[str | None] = mapped_column(String(60))  # numeric/percentage/allelic detail if applicable
    method: Mapped[str | None] = mapped_column(String(60))  # IHC / FISH / NGS / PCR
    lab_name: Mapped[str | None] = mapped_column(String(120))
    tested_date: Mapped[date | None] = mapped_column(Date)
    report_uri: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    diagnosis: Mapped["Diagnosis"] = relationship(back_populates="biomarkers")


class ChemoRegimen(Base):
    """A planned chemotherapy / systemic therapy regimen (protocol) for a diagnosis."""

    __tablename__ = "chemo_regimen"

    regimen_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    diagnosis_id: Mapped[str] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    protocol_name: Mapped[str] = mapped_column(String(120))  # e.g. "AC-T", "FOLFOX", "R-CHOP"
    intent: Mapped[str | None] = mapped_column(String(20))  # CURATIVE / PALLIATIVE / NEOADJUVANT / ADJUVANT
    line_of_therapy: Mapped[int | None] = mapped_column(Integer)  # 1 = first-line, 2 = second-line ...
    drugs: Mapped[list | None] = mapped_column(JSON, default=list)  # [{name, dose, route}, ...]
    cycle_length_days: Mapped[int | None] = mapped_column(Integer)
    planned_cycles: Mapped[int | None] = mapped_column(Integer)
    prescribed_by: Mapped[str | None] = mapped_column(String(36))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="PLANNED")  # PLANNED / ACTIVE / COMPLETED / DISCONTINUED
    discontinued_reason: Mapped[str | None] = mapped_column(String(200))
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    diagnosis: Mapped["Diagnosis"] = relationship(back_populates="chemo_regimens")
    cycles: Mapped[list["ChemoCycle"]] = relationship(back_populates="regimen", cascade="all, delete-orphan")


class ChemoCycle(Base):
    """A single administered (or scheduled) cycle within a chemo regimen."""

    __tablename__ = "chemo_cycle"

    cycle_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    regimen_id: Mapped[str] = mapped_column(ForeignKey("chemo_regimen.regimen_id"))
    cycle_number: Mapped[int] = mapped_column(Integer)
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    administered_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="SCHEDULED")  # SCHEDULED / ADMINISTERED / DELAYED / SKIPPED
    delay_reason: Mapped[str | None] = mapped_column(String(200))
    weight_kg: Mapped[float | None] = mapped_column(Float)
    bsa_m2: Mapped[float | None] = mapped_column(Float)  # body surface area, used for dosing
    toxicities: Mapped[list | None] = mapped_column(JSON, default=list)  # [{ctcae_term, grade}, ...]
    administered_by: Mapped[str | None] = mapped_column(String(36))
    notes: Mapped[str | None] = mapped_column(Text)
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    regimen: Mapped["ChemoRegimen"] = relationship(back_populates="cycles")


class TumorBoardCase(Base):
    """A multidisciplinary tumor board (MDT) discussion for a diagnosis."""

    __tablename__ = "tumor_board_case"

    case_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    diagnosis_id: Mapped[str] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    presenting_doctor_id: Mapped[str | None] = mapped_column(String(36))
    attendees: Mapped[list | None] = mapped_column(JSON, default=list)  # [{staff_id, name, specialty}, ...]
    case_summary: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="SCHEDULED")  # SCHEDULED / DISCUSSED / DEFERRED
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    diagnosis: Mapped["Diagnosis"] = relationship(back_populates="tumor_board_cases")


class RadiologyReport(Base):
    """An oncology-grade imaging report (CT/MRI/PET) with staging-relevant findings."""

    __tablename__ = "radiology_report"

    report_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    diagnosis_id: Mapped[str | None] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    lab_order_id: Mapped[str | None] = mapped_column(ForeignKey("lab_order.lab_order_id"))
    modality: Mapped[str | None] = mapped_column(String(20))  # CT / MRI / PET-CT / X-RAY / USG
    body_region: Mapped[str | None] = mapped_column(String(60))
    findings: Mapped[str | None] = mapped_column(Text)
    impression: Mapped[str | None] = mapped_column(Text)
    recist_response: Mapped[str | None] = mapped_column(String(20))  # CR / PR / SD / PD (RECIST 1.1)
    reported_by: Mapped[str | None] = mapped_column(String(36))
    attachment_uri: Mapped[str | None] = mapped_column(Text)
    reported_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PathologyReport(Base):
    """A histopathology / cytopathology report (biopsy, resection, cytology)."""

    __tablename__ = "pathology_report"

    report_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    diagnosis_id: Mapped[str | None] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    lab_order_id: Mapped[str | None] = mapped_column(ForeignKey("lab_order.lab_order_id"))
    specimen_type: Mapped[str | None] = mapped_column(String(80))  # BIOPSY / RESECTION / FNAC / CORE
    specimen_site: Mapped[str | None] = mapped_column(String(120))
    gross_description: Mapped[str | None] = mapped_column(Text)
    microscopic_description: Mapped[str | None] = mapped_column(Text)
    diagnosis_text: Mapped[str | None] = mapped_column(Text)
    margins_status: Mapped[str | None] = mapped_column(String(40))  # CLEAR / INVOLVED / CLOSE
    lymph_nodes_examined: Mapped[int | None] = mapped_column(Integer)
    lymph_nodes_positive: Mapped[int | None] = mapped_column(Integer)
    reported_by: Mapped[str | None] = mapped_column(String(36))
    attachment_uri: Mapped[str | None] = mapped_column(Text)
    reported_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SurvivorshipPlan(Base):
    """Post-treatment survivorship care plan — surveillance schedule and late-effects monitoring."""

    __tablename__ = "survivorship_plan"

    plan_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    diagnosis_id: Mapped[str] = mapped_column(ForeignKey("diagnosis.diagnosis_id"))
    treatment_summary: Mapped[str | None] = mapped_column(Text)
    surveillance_schedule: Mapped[list | None] = mapped_column(JSON, default=list)  # [{test, interval_months}, ...]
    late_effects_risks: Mapped[list | None] = mapped_column(JSON, default=list)
    next_followup_date: Mapped[date | None] = mapped_column(Date)
    lifestyle_recommendations: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE / CLOSED
    created_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
