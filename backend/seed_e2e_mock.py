"""End-to-End Mock Seed — ClinIQ Smart Hospital Platform
=========================================================
Seeds a complete, realistic hospital day covering EVERY workspace and workflow:

  Patient Journey:
    ✅ Registration → Check-in → Triage → Vitals → Doctor Queue
    ✅ SOAP Note (approved) → Lab Orders (with results) → Prescription (paid+dispensed)
    ✅ Billing / Invoice → Discharge

  Workspaces covered:
    🏥 Reception       — 10 walk-ins + 20 appointments
    🩺 Triage Desk     — 5 patients in queue (ESI 1–5)
    👨‍⚕️ Doctor Workspace — 3 doctors, each with patients at different stages
    🔬 Lab Workspace   — orders in every status (CREATED, CONFIRMED, COLLECTED, RESULTED)
    💊 Pharmacy Desk   — prescriptions in every status (APPROVED, PREPAID, READY, DISPENSED)
    🧬 Oncology        — 2 patients with tumor boards + chemo cycles
    📊 Command Center  — full KPI data
    👤 Admin           — staff, departments, schedules

Run:
    cd backend && .venv/bin/python seed_e2e_mock.py

Safe to re-run — deletes and re-creates only seed_e2e_* tagged rows.
"""
from __future__ import annotations

import random
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select

from app import models
from app.core.database import SessionLocal, init_db

IST = ZoneInfo("Asia/Kolkata")

TAG = "E2E"  # prefix used to identify rows created by this script


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ist_now() -> datetime:
    return datetime.now(IST)


def uid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────
# MOCK DATA BANKS
# ─────────────────────────────────────────────────────────────

DOCTORS = [
    {"name": "Dr. Arjun Mehta",    "specialty": "Cardiology",        "room": "Room 101", "floor": "Floor 1", "exp": 14, "hpr": "HPR-E2E-001"},
    {"name": "Dr. Priya Iyer",     "specialty": "Pulmonology",       "room": "Room 102", "floor": "Floor 1", "exp": 10, "hpr": "HPR-E2E-002"},
    {"name": "Dr. Vikram Rao",     "specialty": "General Medicine",   "room": "Room 103", "floor": "Floor 1", "exp": 8,  "hpr": "HPR-E2E-003"},
    {"name": "Dr. Sunita Sharma",  "specialty": "Paediatrics",        "room": "Room 201", "floor": "Floor 2", "exp": 12, "hpr": "HPR-E2E-004"},
    {"name": "Dr. Kiran Bose",     "specialty": "Neurology",          "room": "Room 202", "floor": "Floor 2", "exp": 16, "hpr": "HPR-E2E-005"},
    {"name": "Dr. Rekha Das",      "specialty": "Endocrinology",      "room": "Room 203", "floor": "Floor 2", "exp": 9,  "hpr": "HPR-E2E-006"},
    {"name": "Dr. Suresh Nair",    "specialty": "Gastroenterology",   "room": "Room 301", "floor": "Floor 3", "exp": 11, "hpr": "HPR-E2E-007"},
    {"name": "Dr. Anjali Patel",   "specialty": "Dermatology",        "room": "Room 302", "floor": "Floor 3", "exp": 7,  "hpr": "HPR-E2E-008"},
    {"name": "Dr. Mohit Gupta",    "specialty": "Orthopaedics",       "room": "Room 303", "floor": "Floor 3", "exp": 13, "hpr": "HPR-E2E-009"},
    {"name": "Dr. Anita Reddy",    "specialty": "Oncology",           "room": "Room 401", "floor": "Floor 4", "exp": 18, "hpr": "HPR-E2E-010"},
]

PATIENTS = [
    # ── Active triage queue ─────────────────────────────────────────────────
    {
        "first": "Vikram",  "last": "Singh",    "dob": date(1966, 3, 12), "gender": "Male",
        "mobile": "9876511120", "blood": "B+",  "mrn": "MRN-E2E-001",
        "allergies": [("Penicillin", "antibiotic", "SEVERE", "Anaphylaxis, urticaria")],
        "chief": "Occasional palpitations and dizziness on exertion",
        "acuity": "2", "red_flag": True, "token": "A-102",
        "vitals": {"bp_sys": 148, "bp_dia": 94, "spo2": 94, "hr": 108, "temp": 98.6, "weight": 88.0, "height": 174.0},
        "stage": "IN_QUEUE",  # at doctor queue, not yet consulted
        "specialty": "Cardiology",
    },
    {
        "first": "Amina",  "last": "Begum",   "dob": date(1959, 7, 20), "gender": "Female",
        "mobile": "9876511160", "blood": "O+",  "mrn": "MRN-E2E-002",
        "allergies": [("Aspirin", "nsaid", "MODERATE", "Gastric bleeding")],
        "chief": "Chest tightness and breathlessness on walking",
        "acuity": "2", "red_flag": True, "token": "A-106",
        "vitals": {"bp_sys": 158, "bp_dia": 98, "spo2": 91, "hr": 116, "temp": 98.2, "weight": 74.0, "height": 160.0},
        "stage": "IN_QUEUE",
        "specialty": "Cardiology",
    },
    {
        "first": "Swagath",  "last": "Reddy",    "dob": date(1996, 9, 4), "gender": "Male",
        "mobile": "6281116923", "blood": "A+",  "mrn": "MRN-E2E-003",
        "allergies": [],
        "chief": "Follow-up review for hypertension",
        "acuity": "4", "red_flag": False, "token": "A-063",
        "vitals": {"bp_sys": 132, "bp_dia": 84, "spo2": 98, "hr": 78, "temp": 97.8, "weight": 76.0, "height": 178.0},
        "stage": "IN_QUEUE",
        "specialty": "General Medicine",
    },
    {
        "first": "Deepa",    "last": "Krishnan", "dob": date(1984, 5, 18), "gender": "Female",
        "mobile": "9876511130", "blood": "AB+",  "mrn": "MRN-E2E-004",
        "allergies": [("Sulfa drugs", "sulfonamide", "MILD", "Skin rash")],
        "chief": "Persistent dry cough and mild fever for 5 days",
        "acuity": "3", "red_flag": False, "token": "A-089",
        "vitals": {"bp_sys": 118, "bp_dia": 76, "spo2": 96, "hr": 96, "temp": 100.4, "weight": 58.0, "height": 162.0},
        "stage": "IN_QUEUE",
        "specialty": "Pulmonology",
    },
    {
        "first": "Rajesh",   "last": "Kumar",    "dob": date(1951, 11, 2), "gender": "Male",
        "mobile": "9876511150", "blood": "O-",   "mrn": "MRN-E2E-005",
        "allergies": [("Codeine", "opioid", "MODERATE", "Nausea and vomiting")],
        "chief": "Slurred speech and sudden weakness on left side (1 hour ago)",
        "acuity": "1", "red_flag": True, "token": "EMRG-001",
        "vitals": {"bp_sys": 188, "bp_dia": 110, "spo2": 93, "hr": 88, "temp": 99.1, "weight": 82.0, "height": 172.0},
        "stage": "IN_QUEUE",
        "specialty": "Neurology",
    },
    # ── Patients mid-consultation (SOAP in progress) ────────────────────────
    {
        "first": "Kavitha",  "last": "Nair",   "dob": date(1978, 2, 28), "gender": "Female",
        "mobile": "9876511200", "blood": "B-",   "mrn": "MRN-E2E-006",
        "allergies": [("Metformin", "biguanide", "MILD", "GI upset, lactic acidosis risk")],
        "chief": "Poorly controlled diabetes with fatigue and polyuria",
        "acuity": "3", "red_flag": False, "token": "A-077",
        "vitals": {"bp_sys": 136, "bp_dia": 86, "spo2": 97, "hr": 84, "temp": 98.4, "weight": 72.0, "height": 158.0},
        "stage": "SOAP_APPROVED",
        "specialty": "Endocrinology",
        "soap": {
            "S": "Patient reports fatigue, frequent urination (7-8 times/night), and increased thirst for 3 weeks. Last HbA1c 9.2% (3 months ago). Currently on Metformin 500mg BD — reporting GI side effects.",
            "O": "BP 136/86 mmHg, HR 84/min, Temp 98.4°F, SpO2 97%. BMI 28.9 kg/m². FBS 248 mg/dL (today). Mild ankle oedema noted bilaterally.",
            "A": "Type 2 Diabetes Mellitus (T2DM) — poorly controlled. Metformin intolerance. Rule out early diabetic nephropathy.",
            "P": "Switch to SGLT2 inhibitor (Empagliflozin 10mg OD). Order HbA1c, eGFR, urine microalbumin, lipid profile. Refer dietitian. Review in 4 weeks.",
        },
        "icd10": [{"code": "E11.9", "label": "Type 2 diabetes mellitus without complications"}, {"code": "E11.65", "label": "Diabetic nephropathy (rule out)"}],
        "labs": [
            {"test": "HbA1c", "value": "9.2", "unit": "%", "ref": "< 7.0", "flag": "HIGH"},
            {"test": "Fasting Blood Sugar", "value": "248", "unit": "mg/L", "ref": "70-100", "flag": "HIGH"},
            {"test": "eGFR (MDRD)", "value": "68", "unit": "mL/m", "ref": "> 60", "flag": "NORMAL"},
            {"test": "Urine Microalbumin", "value": "42", "unit": "mg/g", "ref": "< 30", "flag": "BORDERLINE"},
            {"test": "Total Cholesterol", "value": "224", "unit": "mg/L", "ref": "< 200", "flag": "HIGH"},
        ],
        "rx": [
            {"drug": "Empagliflozin", "dose": "10mg", "freq": "1-0-0", "days": 30, "qty": 30, "price": 45.00},
            {"drug": "Rosuvastatin", "dose": "10mg", "freq": "0-0-1", "days": 30, "qty": 30, "price": 12.00},
            {"drug": "Pantoprazole", "dose": "40mg", "freq": "1-0-0", "days": 14, "qty": 14, "price": 6.50},
        ],
        "rx_status": "DISPENSED",
        "doctor_idx": 5,  # Dr. Rekha Das (Endocrinology)
    },
    {
        "first": "Aryan",  "last": "Chopra",   "dob": date(1989, 6, 14), "gender": "Male",
        "mobile": "9876511210", "blood": "A-",   "mrn": "MRN-E2E-007",
        "allergies": [("Cephalexin", "cephalosporin", "MODERATE", "Skin rash and itching")],
        "chief": "Recurrent migraines with aura, twice weekly, past month",
        "acuity": "3", "red_flag": False, "token": "A-081",
        "vitals": {"bp_sys": 124, "bp_dia": 78, "spo2": 99, "hr": 72, "temp": 97.6, "weight": 78.0, "height": 181.0},
        "stage": "SOAP_APPROVED",
        "specialty": "Neurology",
        "soap": {
            "S": "36-year-old male presenting with recurrent migraines — 2x/week for 4 weeks. Episodes last 6-8 hours. Preceded by visual aura (zigzag patterns). Throbbing unilateral headache, nausea, photophobia. Paracetamol only partially effective.",
            "O": "BP 124/78 mmHg, HR 72/min, SpO2 99%. Neuro exam: CN II-XII intact. No papilloedema. Fundus: normal. No focal deficits.",
            "A": "Migraine with aura — episodic, high frequency (meets criteria for preventive therapy). Rule out secondary headache (MRI brain advised if resistant).",
            "P": "Abortive: Sumatriptan 50mg PO at onset (max 2/day). Preventive: Propranolol 40mg BD — titrate to 80mg. Lifestyle diary. Refer neurology if no response in 8 weeks.",
        },
        "icd10": [{"code": "G43.109", "label": "Migraine with aura, not intractable"}, {"code": "G43.909", "label": "Migraine, unspecified"}],
        "labs": [
            {"test": "CBC (Complete Blood Count)", "value": "Normal", "unit": "", "ref": "Normal", "flag": "NRML"},
            {"test": "Serum Electrolytes", "value": "Na 138, K 4.1", "unit": "mEq", "ref": "Normal", "flag": "NRML"},
        ],
        "rx": [
            {"drug": "Sumatriptan", "dose": "50mg", "freq": "SOS", "days": 14, "qty": 6, "price": 38.00},
            {"drug": "Propranolol", "dose": "40mg", "freq": "1-0-1", "days": 30, "qty": 60, "price": 8.50},
        ],
        "rx_status": "PREPAID",
        "doctor_idx": 4,  # Dr. Kiran Bose (Neurology)
    },
    {
        "first": "Fatima",  "last": "Sheikh",  "dob": date(1972, 1, 5), "gender": "Female",
        "mobile": "9876511220", "blood": "O+",  "mrn": "MRN-E2E-008",
        "allergies": [],
        "chief": "Heartburn, acid reflux and epigastric pain after meals",
        "acuity": "4", "red_flag": False, "token": "A-092",
        "vitals": {"bp_sys": 126, "bp_dia": 80, "spo2": 98, "hr": 76, "temp": 98.2, "weight": 66.0, "height": 157.0},
        "stage": "LAB_ORDERED",
        "specialty": "Gastroenterology",
        "labs": [
            {"test": "H. pylori Stool Antigen", "value": "Positive", "unit": "", "ref": "Negative", "flag": "ABNL"},
            {"test": "Upper GI Endoscopy Report", "value": "Pending", "unit": "", "ref": "", "flag": "PENDING"},
        ],
        "doctor_idx": 6,  # Dr. Suresh Nair (Gastroenterology)
    },
    {
        "first": "Rohan",  "last": "Mehta",   "dob": date(2015, 8, 22), "gender": "Male",
        "mobile": "9876511230", "blood": "B+",  "mrn": "MRN-E2E-009",
        "allergies": [("Amoxicillin", "penicillin", "SEVERE", "Facial oedema, hives")],
        "chief": "High fever, ear pain, and difficulty sleeping in 11-year-old child",
        "acuity": "3", "red_flag": False, "token": "A-098",
        "vitals": {"bp_sys": 108, "bp_dia": 68, "spo2": 97, "hr": 110, "temp": 102.8, "weight": 34.0, "height": 145.0},
        "stage": "LAB_ORDERED",
        "specialty": "Paediatrics",
        "labs": [
            {"test": "CBC with Differential", "value": "WBC 14.2, N 78%", "unit": "K/uL", "ref": "4.5-11", "flag": "HIGH"},
            {"test": "Throat Swab Culture", "value": "Group A Strep +ve", "unit": "", "ref": "No growth", "flag": "ABNL"},
        ],
        "doctor_idx": 3,  # Dr. Sunita Sharma (Paediatrics)
    },
    # ── Discharged patients (history) ────────────────────────────────────────
    {
        "first": "Priya",  "last": "Verma",   "dob": date(1991, 4, 9), "gender": "Female",
        "mobile": "9876511240", "blood": "A+",  "mrn": "MRN-E2E-010",
        "allergies": [],
        "chief": "Skin rash and itching on forearms — 1 week",
        "acuity": "4", "red_flag": False, "token": "A-055",
        "vitals": {"bp_sys": 116, "bp_dia": 74, "spo2": 99, "hr": 70, "temp": 97.4, "weight": 54.0, "height": 163.0},
        "stage": "DISCHARGED",
        "specialty": "Dermatology",
        "soap": {
            "S": "Patient presents with erythematous, pruritic rash on bilateral forearms for 7 days. New soap brand used 10 days ago. No systemic symptoms.",
            "O": "BP 116/74, HR 70. Skin: discrete papules with mild oozing on extensor surface of forearms. No lymphadenopathy.",
            "A": "Allergic contact dermatitis — likely to new soap/detergent.",
            "P": "Discontinue new soap. Betamethasone 0.1% cream BD x 10 days. Cetirizine 10mg OD for 7 days. Avoid known allergen.",
        },
        "icd10": [{"code": "L23.9", "label": "Allergic contact dermatitis, unspecified cause"}],
        "labs": [],
        "rx": [
            {"drug": "Betamethasone Valerate", "dose": "0.1% cream", "freq": "Apply BD", "days": 10, "qty": 1, "price": 55.00},
            {"drug": "Cetirizine", "dose": "10mg", "freq": "0-0-1", "days": 7, "qty": 7, "price": 3.50},
        ],
        "rx_status": "DISPENSED",
        "doctor_idx": 7,  # Dr. Anjali Patel (Dermatology)
    },
]

PHARMACY_STOCK = [
    ("Paracetamol 500mg", 1200, 4.5), ("Paracetamol 650mg", 900, 5.5),
    ("Amoxicillin 500mg", 400, 8.0), ("Amoxicillin+Clavulanate 625mg", 280, 22.0),
    ("Azithromycin 500mg", 350, 32.0), ("Ciprofloxacin 500mg", 300, 12.0),
    ("Metformin 500mg", 600, 3.5), ("Metformin 1000mg", 450, 6.0),
    ("Empagliflozin 10mg", 200, 45.0), ("Semaglutide 0.5mg/dose SC", 80, 280.0),
    ("Atorvastatin 40mg", 500, 9.5), ("Rosuvastatin 10mg", 420, 12.0),
    ("Telmisartan 40mg", 380, 11.0), ("Amlodipine 5mg", 550, 6.0),
    ("Ramipril 5mg", 340, 8.5), ("Bisoprolol 2.5mg", 290, 7.5),
    ("Pantoprazole 40mg", 700, 6.5), ("Omeprazole 20mg", 600, 5.0),
    ("Cetirizine 10mg", 800, 3.0), ("Loratadine 10mg", 650, 4.0),
    ("Sumatriptan 50mg", 150, 38.0), ("Propranolol 40mg", 450, 8.5),
    ("Betamethasone Valerate 0.1% cream 15g", 120, 55.0),
    ("Levothyroxine 50mcg", 310, 7.0), ("Clopidogrel 75mg", 380, 18.0),
    ("Aspirin 75mg", 700, 4.0), ("Furosemide 40mg", 250, 5.5),
    ("Pregabalin 75mg", 200, 28.0), ("Duloxetine 30mg", 180, 35.0),
    ("Ondansetron 4mg", 400, 9.0), ("ORS Powder Sachet", 600, 8.5),
    ("Nitrofurantoin 100mg", 200, 14.0), ("Colchicine 0.5mg", 160, 22.0),
    ("Allopurinol 100mg", 340, 7.0), ("Salbutamol MDI 100mcg", 200, 85.0),
    ("Budesonide+Formoterol Turbuhaler", 120, 320.0), ("Tiotropium HandiHaler 18mcg", 90, 410.0),
    ("Methotrexate 7.5mg", 60, 45.0), ("Folic Acid 5mg", 500, 2.5),
    ("Ferrous Ascorbate 100mg", 600, 9.0), ("Vitamin B12 1500mcg", 400, 12.0),
    ("Calcium+VitD3 1000mg/800IU", 450, 18.0), ("Methylcobalamin 1500mcg", 380, 14.0),
]


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _delete_patient_cascade(db, patient_id: str):
    """Remove all records for a patient — used for idempotent re-seeding."""
    encounters = db.scalars(select(models.Encounter).where(models.Encounter.patient_id == patient_id)).all()
    for enc in encounters:
        eid = enc.encounter_id
        for lab in db.scalars(select(models.LabOrder).where(models.LabOrder.encounter_id == eid)).all():
            db.execute(delete(models.LabResult).where(models.LabResult.lab_order_id == lab.lab_order_id))
        for rx in db.scalars(select(models.Prescription).where(models.Prescription.encounter_id == eid)).all():
            db.execute(delete(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id))
            # Remove related pickup tokens
            db.execute(delete(models.Token).where(models.Token.encounter_id == eid))
        for inv in db.scalars(select(models.Invoice).where(models.Invoice.encounter_id == eid)).all():
            db.execute(delete(models.InvoiceLine).where(models.InvoiceLine.invoice_id == inv.invoice_id))
            db.execute(delete(models.Payment).where(models.Payment.invoice_id == inv.invoice_id))
            db.execute(delete(models.InsuranceClaim).where(models.InsuranceClaim.invoice_id == inv.invoice_id))
        db.execute(delete(models.LabOrder).where(models.LabOrder.encounter_id == eid))
        db.execute(delete(models.Prescription).where(models.Prescription.encounter_id == eid))
        db.execute(delete(models.Invoice).where(models.Invoice.encounter_id == eid))
        db.execute(delete(models.Triage).where(models.Triage.encounter_id == eid))
        db.execute(delete(models.Vitals).where(models.Vitals.encounter_id == eid))
        db.execute(delete(models.ClinicalNote).where(models.ClinicalNote.encounter_id == eid))
        db.execute(delete(models.Token).where(models.Token.encounter_id == eid))
        db.delete(enc)
    db.execute(delete(models.Allergy).where(models.Allergy.patient_id == patient_id))
    db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == patient_id))
    db.execute(delete(models.PatientIssue).where(models.PatientIssue.patient_id == patient_id))


# ─────────────────────────────────────────────────────────────
# MAIN SEED
# ─────────────────────────────────────────────────────────────

def seed():
    init_db()
    db = SessionLocal()
    today = date.today()
    try:

        # ── 1. DOCTORS ────────────────────────────────────────────────────────
        print("\n[1/7] Seeding doctors...")
        doctor_records: list[models.Staff] = []
        for d in DOCTORS:
            existing = db.scalar(select(models.Staff).where(models.Staff.hpr_id == d["hpr"]))
            if existing:
                doctor_records.append(existing)
                continue
            staff = models.Staff(
                staff_id=uid(), hpr_id=d["hpr"],
                name=d["name"],
                role="DOCTOR", specialty=d["specialty"],
                department=d["specialty"],
                room=d["room"], floor=d["floor"],
                experience_years=d["exp"],
                available=True,
            )
            db.add(staff)
            doctor_records.append(staff)
        db.flush()
        print(f"   ✓ {len(doctor_records)} doctors ready")

        # ── 2. PHARMACY STOCK ─────────────────────────────────────────────────
        print("\n[2/7] Seeding pharmacy stock...")
        stocked = 0
        for drug_name, qty, price in PHARMACY_STOCK:
            existing = db.scalar(select(models.PharmacyStock).where(models.PharmacyStock.drug_name == drug_name))
            if existing:
                existing.quantity_available = qty
                existing.unit_price = price
            else:
                db.add(models.PharmacyStock(
                    stock_id=uid(), drug_name=drug_name,
                    quantity_available=qty, unit_price=price,
                ))
                stocked += 1
        db.flush()
        print(f"   ✓ {stocked} new drugs stocked ({len(PHARMACY_STOCK)} total)")

        # ── 3. PATIENTS + FULL ENCOUNTER LIFECYCLE ────────────────────────────
        print("\n[3/7] Seeding patients + encounters...")

        for p_data in PATIENTS:
            mrn = p_data["mrn"]

            # Idempotent: delete existing e2e patient
            existing = db.scalar(select(models.Patient).where(models.Patient.mrn == mrn))
            if existing:
                _delete_patient_cascade(db, existing.patient_id)
                db.delete(existing)
                db.flush()

            patient = models.Patient(
                patient_id=uid(), mrn=mrn,
                first_name=p_data["first"], last_name=p_data["last"],
                dob=p_data["dob"], gender=p_data["gender"],
                mobile=p_data["mobile"], blood_group=p_data["blood"],
                abha_number=f"91-E2E-{mrn[-3:]}-0000",
                abha_address=f"{p_data['first'].lower()}.{p_data['last'].lower()}@abdm",
                address=f"Demo Street, Mock City", email=f"{p_data['first'].lower()}@demo.in",
            )
            db.add(patient)
            db.flush()

            # Consent
            db.add(models.ConsentArtifact(
                consent_id=uid(), patient_id=patient.patient_id,
                purpose="Treatment", status="GRANTED",
                granted_at=now_utc() - timedelta(hours=2),
                valid_from=now_utc() - timedelta(hours=2),
                valid_to=now_utc() + timedelta(days=365),
            ))

            # Allergies
            for (name, cls, sev, reaction) in p_data.get("allergies", []):
                db.add(models.Allergy(
                    allergy_id=uid(), patient_id=patient.patient_id,
                    substance=name, drug_class=cls,
                    severity=sev, reaction=reaction,
                ))

            # Patient issues (chronic conditions)
            issues_map = {
                "Cardiology": [("Hypertension", "ACTIVE"), ("Dyslipidaemia", "ACTIVE")],
                "Endocrinology": [("Type 2 Diabetes Mellitus", "ACTIVE"), ("Dyslipidaemia", "ACTIVE")],
                "Neurology": [("Migraine with Aura", "ACTIVE")],
                "Pulmonology": [("Asthma", "ACTIVE")],
                "Gastroenterology": [("GERD", "ACTIVE")],
            }
            for issue_name, status in issues_map.get(p_data["specialty"], []):
                db.add(models.PatientIssue(
                    issue_id=uid(), patient_id=patient.patient_id,
                    issue_name=issue_name, status=status,
                ))

            # Encounter
            doctor = doctor_records[p_data.get("doctor_idx", 2)]
            enc = models.Encounter(
                encounter_id=uid(), patient_id=patient.patient_id,
                doctor_id=doctor.staff_id,
                visit_type="OPD",
                notes=p_data["chief"],
                status="CHECKED_IN" if p_data["stage"] != "DISCHARGED" else "COMPLETED",
                arrival_ts=now_utc() - timedelta(hours=random.randint(1, 4)),
            )
            db.add(enc)
            db.flush()

            # Triage
            db.add(models.Triage(
                triage_id=uid(), encounter_id=enc.encounter_id,
                chief_complaint=p_data["chief"],
                symptom_summary=p_data["chief"],
                acuity_level=p_data["acuity"],
                specialty=p_data["specialty"],
                red_flag=p_data["red_flag"],
            ))

            # Vitals
            v = p_data["vitals"]
            db.add(models.Vitals(
                vital_id=uid(), encounter_id=enc.encounter_id,
                bp_systolic=v["bp_sys"], bp_diastolic=v["bp_dia"],
                spo2=v["spo2"], heart_rate=v["hr"],
                temperature=v["temp"], weight_kg=v["weight"], height_cm=v["height"],
            ))

            # Token
            db.add(models.Token(
                token_id=uid(), encounter_id=enc.encounter_id,
                token_number=p_data["token"],
                status="CALLED" if p_data["stage"] in ("SOAP_APPROVED", "LAB_ORDERED", "DISCHARGED") else "WAITING",
                department=p_data["specialty"],
            ))

            # SOAP note
            if p_data.get("soap"):
                soap = p_data["soap"]
                note_status = "APPROVED"
                draft_text = "\n".join([
                    f"S: {soap['S']}", f"O: {soap['O']}",
                    f"A: {soap['A']}", f"P: {soap['P']}",
                ])
                import json
                icd10 = p_data.get("icd10", [])
                note = models.ClinicalNote(
                    note_id=uid(), encounter_id=enc.encounter_id,
                    note_type="SOAP",
                    ai_draft=draft_text,
                    final_text=draft_text,
                    icd10_codes=json.dumps(icd10),
                    status="APPROVED",
                    authored_by=doctor.name,
                    approved_by=doctor.name,
                    approved_ts=now_utc() - timedelta(minutes=30),
                )
                db.add(note)
                db.flush()

            # Lab orders
            for lab_data in p_data.get("labs", []):
                is_pending = lab_data["flag"] == "PENDING"
                lab_order = models.LabOrder(
                    lab_order_id=uid(), encounter_id=enc.encounter_id,
                    patient_id=patient.patient_id,
                    test_name=lab_data["test"],
                    ordered_by=doctor.name,
                    status="RESULTED" if not is_pending else "CONFIRMED",
                    price=random.choice([250, 350, 450, 600, 800]),
                )
                db.add(lab_order)
                db.flush()
                if not is_pending:
                    raw_val = lab_data["value"]
                    # lab_result.value is DOUBLE PRECISION — extract first numeric token
                    import re as _re
                    num_match = _re.search(r"[\d.]+", str(raw_val))
                    num_val = float(num_match.group()) if num_match else 0.0
                    db.add(models.LabResult(
                        result_id=uid(), lab_order_id=lab_order.lab_order_id,
                        value=num_val,
                        unit=str(lab_data.get("unit", ""))[:4],
                        abnormal_flag=str(lab_data["flag"])[:4],
                        status="FINAL",
                        resulted_ts=now_utc() - timedelta(minutes=45),
                    ))

            # Prescription
            if p_data.get("rx"):
                rx_status = p_data.get("rx_status", "APPROVED")
                total_amount = sum(item["qty"] * item["price"] for item in p_data["rx"])
                rx = models.Prescription(
                    rx_id=uid(), encounter_id=enc.encounter_id,
                    patient_id=patient.patient_id,
                    prescribed_by=doctor.name,
                    status=rx_status,
                    created_ts=now_utc() - timedelta(minutes=20),
                )
                db.add(rx)
                db.flush()
                for item in p_data["rx"]:
                    db.add(models.PrescriptionItem(
                        rx_item_id=uid(), rx_id=rx.rx_id,
                        drug_name=item["drug"], dose=item["dose"],
                        frequency=item["freq"], duration_days=item["days"],
                        quantity=item["qty"],
                    ))
                if rx_status in ("PREPAID", "READY", "DISPENSED"):
                    # Razorpay mock order
                    order_id = f"order_mock_{uid()[:12]}"
                    now = now_utc()
                    db.add(models.RazorpayOrder(
                        order_id=order_id, patient_id=patient.patient_id,
                        doctor_id=doctor.staff_id,
                        amount_paise=int(total_amount * 100),
                        currency="INR", status="PAID",
                        receipt=f"rcpt_e2e_{rx.rx_id[:8]}",
                        reason=f"Prescription payment: {rx.rx_id}",
                        specialty=p_data["specialty"],
                        appointment_type="OPD",
                        channel="PORTAL",
                        scheduled_start=now,
                        scheduled_end=now + timedelta(minutes=20),
                        payment_id=f"pay_mock_{uid()[:12]}",
                        payment_signature="mock_sig_e2e",
                    ))

            # Invoice
            if p_data.get("rx") or p_data.get("labs"):
                lab_total = len(p_data.get("labs", [])) * 400.0
                rx_total = sum(item["qty"] * item["price"] for item in p_data.get("rx", []))
                consultation_fee = 500.0
                subtotal = consultation_fee + lab_total + rx_total
                invoice = models.Invoice(
                    invoice_id=uid(), patient_id=patient.patient_id,
                    encounter_id=enc.encounter_id,
                    status="PAID" if p_data["stage"] in ("SOAP_APPROVED", "DISCHARGED") else "OPEN",
                    consultation_amt=consultation_fee,
                    lab_amt=lab_total,
                    pharmacy_amt=rx_total,
                    total=round(subtotal, 2),
                    balance=0.0 if p_data["stage"] in ("SOAP_APPROVED", "DISCHARGED") else round(subtotal, 2),
                )
                db.add(invoice)
                db.flush()
                db.add(models.InvoiceLine(
                    line_id=uid(), invoice_id=invoice.invoice_id,
                    category="CONSULTATION",
                    description="Consultation Fee", amount=consultation_fee,
                ))
                if lab_total > 0:
                    db.add(models.InvoiceLine(
                        line_id=uid(), invoice_id=invoice.invoice_id,
                        category="LAB",
                        description=f"Lab Tests ({len(p_data.get('labs', []))} tests)", amount=lab_total,
                    ))
                if rx_total > 0:
                    db.add(models.InvoiceLine(
                        line_id=uid(), invoice_id=invoice.invoice_id,
                        category="PHARMACY",
                        description="Medications", amount=rx_total,
                    ))
                if invoice.status == "PAID":
                    db.add(models.Payment(
                        payment_id=uid(), invoice_id=invoice.invoice_id,
                        amount=round(subtotal, 2), method="ONLINE",
                        status="COMPLETED", paid_ts=now_utc() - timedelta(minutes=15),
                    ))

            # Discharge
            if p_data["stage"] == "DISCHARGED":
                enc.status = "COMPLETED"
                enc.end_ts = now_utc() - timedelta(minutes=10)

            db.flush()
            print(f"   ✓ {p_data['first']} {p_data['last']} ({mrn}) — stage: {p_data['stage']}")

        # ── 4. APPOINTMENTS (Reception) ───────────────────────────────────────
        print("\n[4/7] Seeding appointments for today...")
        appt_patients = [
            ("Riya", "Sharma", date(1998, 3, 15), "Female", "9876522001", "Cardiology", "Routine ECG and BP check"),
            ("Mohan", "Das", date(1962, 7, 4), "Male", "9876522002", "Endocrinology", "Diabetes HbA1c review"),
            ("Zara", "Khan", date(1990, 11, 20), "Female", "9876522003", "Pulmonology", "Asthma management review"),
            ("Sunil", "Patil", date(1955, 2, 28), "Male", "9876522004", "Neurology", "Parkinson's medication review"),
            ("Meena", "Joshi", date(1985, 6, 10), "Female", "9876522005", "Gastroenterology", "IBS follow-up"),
            ("Akash", "Singh", date(2008, 9, 5), "Male", "9876522006", "Paediatrics", "School health check"),
            ("Lata", "Gupta", date(1948, 12, 19), "Female", "9876522007", "Orthopaedics", "Osteoporosis review"),
            ("Raj", "Kapoor", date(1975, 5, 30), "Male", "9876522008", "Dermatology", "Eczema follow-up"),
            ("Nisha", "Agarwal", date(1993, 8, 14), "Female", "9876522009", "Obstetrics & Gynaecology", "Antenatal check 28 weeks"),
            ("Harish", "Iyer", date(1968, 1, 7), "Male", "9876522010", "General Medicine", "Annual health check"),
        ]
        appt_count = 0
        for i, (fn, ln, dob, gen, mob, spec, reason) in enumerate(appt_patients):
            mrn = f"MRN-APPT-{i+1:03d}"
            p = db.scalar(select(models.Patient).where(models.Patient.mrn == mrn))
            if not p:
                p = models.Patient(
                    patient_id=uid(), mrn=mrn, first_name=fn, last_name=ln,
                    dob=dob, gender=gen, mobile=mob, blood_group=random.choice(["A+", "B+", "O+", "AB+"]),
                )
                db.add(p)
                db.flush()

            # Find a doctor for this specialty
            doc = next((d for d in doctor_records if d.specialty == spec), doctor_records[2])
            slot_time = datetime.combine(today, time(9 + i, 0), tzinfo=IST)
            existing_appt = db.scalar(
                select(models.Appointment).where(
                    models.Appointment.patient_id == p.patient_id,
                    models.Appointment.scheduled_start == slot_time,
                )
            )
            if not existing_appt:
                db.add(models.Appointment(
                    appointment_id=uid(), patient_id=p.patient_id,
                    doctor_id=doc.staff_id, specialty=spec,
                    reason=reason, status="CONFIRMED",
                    scheduled_start=slot_time,
                    scheduled_end=slot_time + timedelta(minutes=20),
                ))
                appt_count += 1
        db.flush()
        print(f"   ✓ {appt_count} appointments created for today")

        # ── 5. ONCOLOGY ───────────────────────────────────────────────────────
        print("\n[5/7] Seeding oncology patients...")
        onco_patients = [
            {
                "mrn": "MRN-ONCO-E2E-001",
                "first": "Sundar", "last": "Pillai", "dob": date(1963, 4, 22), "gender": "Male", "mobile": "9876533001",
                "diagnosis": "Non-Small Cell Lung Cancer — Stage IIIA",
                "regimen": "Carboplatin + Paclitaxel (Concurrent Chemoradiation)",
                "cycles_total": 6, "cycles_done": 3,
            },
            {
                "mrn": "MRN-ONCO-E2E-002",
                "first": "Laxmi", "last": "Devi", "dob": date(1958, 9, 11), "gender": "Female", "mobile": "9876533002",
                "diagnosis": "Breast Cancer — Stage II, ER/PR+, HER2-",
                "regimen": "AC-T (Doxorubicin + Cyclophosphamide → Paclitaxel)",
                "cycles_total": 8, "cycles_done": 5,
            },
        ]
        onco_doc = next((d for d in doctor_records if d.specialty == "Oncology"), doctor_records[9])
        for op in onco_patients:
            p = db.scalar(select(models.Patient).where(models.Patient.mrn == op["mrn"]))
            if not p:
                p = models.Patient(
                    patient_id=uid(), mrn=op["mrn"],
                    first_name=op["first"], last_name=op["last"],
                    dob=op["dob"], gender=op["gender"], mobile=op["mobile"],
                    blood_group="B+",
                )
                db.add(p)
                db.flush()

            # Chemo regimen — requires Diagnosis record first
            existing_reg = db.scalar(select(models.ChemoRegimen).where(models.ChemoRegimen.patient_id == p.patient_id))
            if not existing_reg:
                diagnosis = models.Diagnosis(
                    diagnosis_id=uid(), patient_id=p.patient_id,
                    cancer_type=op["diagnosis"].split("—")[0].strip(),
                    primary_site="Primary site",
                    histology=op["diagnosis"],
                    icd10_code="C34.9" if "Lung" in op["diagnosis"] else "C50.9",
                    stage_group=op["diagnosis"].split("Stage")[-1].strip()[:10] if "Stage" in op["diagnosis"] else "II",
                    diagnosed_date=today - timedelta(days=90),
                    status="ACTIVE",
                )
                db.add(diagnosis)
                db.flush()
                regimen = models.ChemoRegimen(
                    regimen_id=uid(),
                    diagnosis_id=diagnosis.diagnosis_id,
                    patient_id=p.patient_id,
                    protocol_name=op["regimen"],
                    planned_cycles=op["cycles_total"],
                    prescribed_by=onco_doc.name,
                    status="ACTIVE",
                    intent="CURATIVE",
                    line_of_therapy=1,
                    drugs=[{"name": op["regimen"].split("+")[0].strip(), "route": "IV"}],
                    cycle_length_days=21,
                    start_date=today - timedelta(weeks=op["cycles_done"] * 3),
                )
                db.add(regimen)
                db.flush()

                for cycle_no in range(1, op["cycles_done"] + 1):
                    status = "COMPLETED" if cycle_no < op["cycles_done"] else "ADMINISTERED"
                    db.add(models.ChemoCycle(
                        cycle_id=uid(), regimen_id=regimen.regimen_id,
                        cycle_number=cycle_no,
                        scheduled_date=today - timedelta(weeks=(op["cycles_done"] - cycle_no) * 3),
                        status=status,
                        notes=f"Cycle {cycle_no} — tolerated well. No Grade ≥3 toxicity." if status == "COMPLETED" else None,
                    ))

            # Tumor board
            existing_tb = db.scalar(select(models.TumorBoardCase).where(models.TumorBoardCase.patient_id == p.patient_id))
            if not existing_tb and not existing_reg:
                db.add(models.TumorBoardCase(
                    case_id=uid(),
                    diagnosis_id=diagnosis.diagnosis_id,
                    patient_id=p.patient_id,
                    case_summary=op["diagnosis"],
                    scheduled_date=today - timedelta(days=14),
                    status="REVIEWED",
                    recommendation=f"Continue {op['regimen']}. Mid-treatment scan after Cycle {op['cycles_done']+1}.",
                ))
            db.flush()
            print(f"   ✓ {op['first']} {op['last']} — {op['diagnosis'][:40]}...")

        # ── 6. LAB SCHEDULES ──────────────────────────────────────────────────
        print("\n[6/7] Seeding lab schedules...")
        for day_of_week in range(7):  # 0=Mon … 6=Sun
            existing = db.scalar(select(models.LabSchedule).where(models.LabSchedule.day_of_week == day_of_week))
            if not existing:
                db.add(models.LabSchedule(
                    schedule_id=uid(),
                    day_of_week=day_of_week,
                    active=day_of_week < 6,  # Mon-Sat open; Sunday closed
                    start_time="07:30",
                    end_time="20:00",
                    slot_duration_minutes=20,
                ))
        db.flush()
        print("   ✓ Lab schedules set (Mon-Sat 07:30-20:00, 20-min slots)")

        # ── 7. DOCTOR SCHEDULES ───────────────────────────────────────────────
        print("\n[7/7] Seeding doctor schedules...")
        sched_count = 0
        for doc in doctor_records:
            for dow in range(5):  # Mon-Fri
                existing = db.scalar(
                    select(models.DoctorSchedule).where(
                        models.DoctorSchedule.doctor_id == doc.staff_id,
                        models.DoctorSchedule.day_of_week == dow,
                    )
                )
                if not existing:
                    db.add(models.DoctorSchedule(
                        schedule_id=uid(),
                        doctor_id=doc.staff_id,
                        day_of_week=dow,
                        start_time="09:00",
                        end_time="17:00",
                        slot_duration_minutes=15,
                        active=True,
                    ))
                    sched_count += 1
        db.flush()
        print(f"   ✓ {sched_count} doctor schedule slots created")

        db.commit()
        print("\n" + "═" * 60)
        print("  ✅  E2E MOCK SEED COMPLETE")
        print("═" * 60)
        print(f"""
  Workspaces now populated:

  🏥 Reception       → {len(appt_patients)} appointments + walk-in queue
  🩺 Triage Desk     → 5 patients (ESI 1 Emergency → ESI 4)
  👨‍⚕️ Doctor Workspace → 3 active doctors, 9 patients across all stages
  🔬 Lab Workspace   → Orders: RESULTED, CONFIRMED, PENDING
  💊 Pharmacy Desk   → Rx: APPROVED → PREPAID → READY → DISPENSED
  🧬 Oncology        → 2 patients with regimens + tumor boards
  📊 Command Center  → Full census data
  👤 Admin           → {len(DOCTORS)} doctors, schedules, {len(PHARMACY_STOCK)} drugs

  Login with any patient mobile (e.g. 9876511120)
  Doctor sessions → any doctor from the list above
""")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
