"""Pydantic request/response schemas (API boundary)."""
from __future__ import annotations

import re
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


# --------------------------------------------------------------------------------- Journey
class CheckInRequest(BaseModel):
    channel: str = Field(default="KIOSK", description="WHATSAPP / KIOSK / APP / WALKIN")
    patient_id: str | None = None
    abha_number: str | None = None
    mobile: str | None = None
    mrn: str | None = None
    first_name: str | None = None
    reason: str | None = None
    appointment_id: str | None = None


class MobileProfilesRequest(BaseModel):
    mobile: str


class OtpSendRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        value = value.strip()
        if len(value) != 10 or not value.isdigit():
            raise ValueError("mobile number must contain exactly 10 digits")
        return value


class OtpVerifyRequest(OtpSendRequest):
    code: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        value = value.strip()
        if not value.isdigit() or not 1 <= len(value) <= 10:
            raise ValueError("OTP must contain 1 to 10 digits")
        return value


class IdentityVerifyRequest(BaseModel):
    method: str = Field(description="ABHA / OTP / MRN")
    value: str


class PatientIssueIn(BaseModel):
    issue_name: str
    onset_info: str | None = None
    status: str = "ACTIVE"


class AllergyIn(BaseModel):
    substance: str
    drug_class: str | None = None
    severity: str | None = None
    reaction: str | None = None


class DocumentIn(BaseModel):
    doc_type: str
    title: str | None = None
    uri: str | None = None

    @field_validator("doc_type")
    @classmethod
    def validate_doc_type(cls, value: str) -> str:
        allowed = {"LAB_REPORT", "DISCHARGE", "SCAN", "AUDIO"}
        if value not in allowed:
            raise ValueError(f"doc_type must be one of {', '.join(sorted(allowed))}")
        return value


class PatientBasicRegistrationRequest(BaseModel):
    first_name: str
    last_name: str
    dob: date
    mobile: str


class PatientRegistrationRequest(BaseModel):
    first_name: str
    last_name: str
    dob: date
    mobile: str
    email: str | None = None
    gender: str
    blood_group: str | None = None
    address: str | None = None
    issues: list[PatientIssueIn] = Field(default_factory=list)
    allergies: list[AllergyIn] = Field(default_factory=list)
    documents: list[DocumentIn] = Field(default_factory=list)

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("date of birth cannot be in the future")
        return value

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        if len(value) != 10 or not value.isdigit():
            raise ValueError("mobile number must contain exactly 10 digits")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if not value:
            return None
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value.strip()):
            raise ValueError("enter a valid email address")
        return value.strip()


class PatientProfileUpdateRequest(BaseModel):
    email: str
    gender: str
    blood_group: str
    address: str
    allergies: list[AllergyIn] = Field(default_factory=list)
    documents: list[DocumentIn] = Field(default_factory=list)


class PatientPhotoUpdateRequest(BaseModel):
    profile_photo: str | None = None

    @field_validator("profile_photo")
    @classmethod
    def validate_profile_photo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        allowed = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
        if not value.startswith(allowed):
            raise ValueError("profile photo must be a JPEG, PNG or WebP image")
        if len(value) > 2_800_000:
            raise ValueError("profile photo must be 2 MB or smaller")
        return value


class ConsentRequest(BaseModel):
    patient_id: str
    purpose: str = "CARE_MGMT"
    hours: int = 24
    hiu_id: str | None = "qconnect-hiu"
    hip_id: str | None = "qconnect-hip"


class VitalsIn(BaseModel):
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    spo2: int | None = None
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    temperature: float | None = None
    weight_kg: float | None = None
    height_cm: float | None = None


class TriageRequest(BaseModel):
    encounter_id: str
    symptom_text: str
    duration: str | None = None
    vitals: VitalsIn | None = None


class TriageOverrideRequest(BaseModel):
    acuity_level: str
    specialty: str
    doctor_id: str
    reason: str
    overridden_by: str | None = None


class AppointmentSlotsRequest(BaseModel):
    encounter_id: str | None = None
    patient_id: str | None = None
    appointment_date: date
    reason: str


class BookAppointmentRequest(BaseModel):
    encounter_id: str | None = None
    patient_id: str
    doctor_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    reason: str
    specialty: str
    appointment_type: str = "OPD"
    channel: str = "KIOSK"


class IntakeRequest(BaseModel):
    symptom_text: str
    duration: str | None = None


# --------------------------------------------------------------------------------- Clinical
class AmbientRequest(BaseModel):
    encounter_id: str
    transcript: str


class ApproveNoteRequest(BaseModel):
    final_text: str
    icd10_codes: list[dict] | None = None
    approved_by: str | None = None


class LabOrderRequest(BaseModel):
    encounter_id: str
    tests: list[str]
    priority: str = "ROUTINE"
    ordered_by: str | None = None


class RxItemIn(BaseModel):
    drug_name: str
    dose: str | None = None
    route: str | None = "PO"
    frequency: str | None = None
    duration_days: int | None = None
    quantity: int | None = None
    instructions: str | None = None


class PrescriptionCreateRequest(BaseModel):
    encounter_id: str
    items: list[RxItemIn]
    current_meds: list[str] = []
    prescribed_by: str | None = None


class ApproveRxRequest(BaseModel):
    approved_by: str | None = None
    accept_substitutions: bool = False
    override_warnings: bool = False


# --------------------------------------------------------------------------------- Billing
class PayRequest(BaseModel):
    method: str = "UPI"
    amount: float | None = None
    reference: str | None = None


class RazorpayOrderRequest(BaseModel):
    patient_id: str | None = None
    doctor_id: str | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    reason: str | None = None
    specialty: str | None = None
    appointment_type: str = "OPD"
    channel: str = "PORTAL"
    checkout_email: str | None = None


class RazorpayVerifyRequest(BaseModel):
    razorpay_payment_id: str | None = None
    razorpay_order_id: str | None = None
    razorpay_signature: str | None = None


class ClaimRequest(BaseModel):
    payer: str
    tpa: str | None = None
    policy_no: str | None = None
    claim_type: str = "CASHLESS"


# --------------------------------------------------------------------------------- Custom Lab Results
class LabResultSubmitItem(BaseModel):
    analyte: str
    value: float
    unit: str | None = None


class LabResultSubmitRequest(BaseModel):
    results: list[LabResultSubmitItem]
    notes: str | None = None
    attachment_name: str | None = None
    attachment_uri: str | None = None


# --------------------------------------------------------------------------------- Admin & Auth
class DoctorRegisterRequest(BaseModel):
    name: str
    role: str = "DOCTOR"
    department: str | None = None
    specialty: str | None = None
    experience_years: int | None = None
    room: str | None = None
    floor: str | None = None
    access_pin: str | None = None
    opd_fee: float = 500.0


class DoctorVerifyPinRequest(BaseModel):
    doctor_id: str
    access_pin: str


class TriageStaffVerifyPinRequest(BaseModel):
    staff_id: str
    access_pin: str


class DoctorUpdateRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    department: str | None = None
    specialty: str | None = None
    experience_years: int | None = None
    room: str | None = None
    floor: str | None = None
    access_pin: str | None = None
    opd_fee: float | None = None


class DoctorScheduleRequest(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_minutes: int = 15


class LabScheduleRequest(BaseModel):
    category: str = "ALL"
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_minutes: int = 20
    max_capacity_per_slot: int = 5


class EncounterNotesAdviceRequest(BaseModel):
    notes: str


class DoctorAvailabilityRequest(BaseModel):
    available: bool


# --------------------------------------------------------------------------------- Oncology
class DiagnosisCreateRequest(BaseModel):
    patient_id: str
    encounter_id: str | None = None
    cancer_type: str
    primary_site: str | None = None
    histology: str | None = None
    icd10_code: str | None = None
    icdo_morphology_code: str | None = None
    grade: str | None = None
    stage_group: str | None = None
    tnm_t: str | None = None
    tnm_n: str | None = None
    tnm_m: str | None = None
    metastatic: bool = False
    metastatic_sites: list[str] = Field(default_factory=list)
    diagnosed_by: str | None = None
    diagnosed_date: date | None = None
    notes: str | None = None


class DiagnosisUpdateRequest(BaseModel):
    stage_group: str | None = None
    tnm_t: str | None = None
    tnm_n: str | None = None
    tnm_m: str | None = None
    metastatic: bool | None = None
    metastatic_sites: list[str] | None = None
    status: str | None = Field(default=None, description="ACTIVE / REMISSION / RECURRENT / RESOLVED")
    notes: str | None = None


class BiomarkerTestCreateRequest(BaseModel):
    patient_id: str
    marker_name: str
    result: str | None = None
    value: str | None = None
    method: str | None = None
    lab_name: str | None = None
    tested_date: date | None = None
    report_uri: str | None = None
    notes: str | None = None


class ChemoRegimenCreateRequest(BaseModel):
    patient_id: str
    protocol_name: str
    intent: str | None = Field(default=None, description="CURATIVE / PALLIATIVE / NEOADJUVANT / ADJUVANT")
    line_of_therapy: int | None = None
    drugs: list[dict] = Field(default_factory=list)
    cycle_length_days: int | None = None
    planned_cycles: int | None = None
    prescribed_by: str | None = None
    start_date: date | None = None


class ChemoRegimenUpdateRequest(BaseModel):
    status: str | None = Field(default=None, description="PLANNED / ACTIVE / COMPLETED / DISCONTINUED")
    discontinued_reason: str | None = None
    end_date: date | None = None


class ChemoCycleCreateRequest(BaseModel):
    cycle_number: int
    scheduled_date: date | None = None
    weight_kg: float | None = None
    bsa_m2: float | None = None


class ChemoCycleUpdateRequest(BaseModel):
    status: str | None = Field(default=None, description="SCHEDULED / ADMINISTERED / DELAYED / SKIPPED")
    administered_date: date | None = None
    delay_reason: str | None = None
    toxicities: list[dict] | None = None
    administered_by: str | None = None
    notes: str | None = None


class TumorBoardCaseCreateRequest(BaseModel):
    patient_id: str
    scheduled_date: date | None = None
    presenting_doctor_id: str | None = None
    attendees: list[dict] = Field(default_factory=list)
    case_summary: str | None = None


class TumorBoardCaseUpdateRequest(BaseModel):
    recommendation: str | None = None
    status: str | None = Field(default=None, description="SCHEDULED / DISCUSSED / DEFERRED")


class RadiologyReportCreateRequest(BaseModel):
    patient_id: str
    diagnosis_id: str | None = None
    lab_order_id: str | None = None
    modality: str | None = Field(default=None, description="CT / MRI / PET-CT / X-RAY / USG")
    body_region: str | None = None
    findings: str | None = None
    impression: str | None = None
    recist_response: str | None = Field(default=None, description="CR / PR / SD / PD")
    reported_by: str | None = None
    attachment_uri: str | None = None


class PathologyReportCreateRequest(BaseModel):
    patient_id: str
    diagnosis_id: str | None = None
    lab_order_id: str | None = None
    specimen_type: str | None = None
    specimen_site: str | None = None
    gross_description: str | None = None
    microscopic_description: str | None = None
    diagnosis_text: str | None = None
    margins_status: str | None = None
    lymph_nodes_examined: int | None = None
    lymph_nodes_positive: int | None = None
    reported_by: str | None = None
    attachment_uri: str | None = None


class SurvivorshipPlanCreateRequest(BaseModel):
    patient_id: str
    treatment_summary: str | None = None
    surveillance_schedule: list[dict] = Field(default_factory=list)
    late_effects_risks: list[str] = Field(default_factory=list)
    next_followup_date: date | None = None
    lifestyle_recommendations: str | None = None
    created_by: str | None = None

class AuditLogOut(BaseModel):
    audit_id: str
    encounter_id: str
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    edited_by_role: str
    edited_by_user: str | None = None
    created_ts: datetime
