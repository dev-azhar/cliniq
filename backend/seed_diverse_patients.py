"""Seed a diverse set of patients across different diseases into the triage/doctor queue.

Idempotent (re-run safe): deletes any prior patient with the same name + all their
encounter children before recreating. Mirrors seed_demo_patients.py's structure
(Patient → Allergy → Consent → Encounter(TRIAGED) → Vitals → Triage → Token) and
adds chronic problem-list entries (PatientIssue) for the long-term conditions.

Run:  cd backend && .venv/bin/python seed_diverse_patients.py
      (honours DATABASE_URL, e.g. sqlite:////abs/path/cliniq_demo.db)
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select

from app import models
from app.core.database import SessionLocal, init_db


PATIENTS = [
    {
        "first_name": "Rahul", "last_name": "Nair", "dob": date(1968, 3, 22), "gender": "Male",
        "mrn": "MRN-500001", "mobile": "9812300001", "blood_group": "B+", "address": "Fort Kochi, Kerala",
        "department": "Pulmonology", "specialty": "Pulmonology",
        "allergies": [("Dust Mite", "environmental", "MODERATE", "Wheezing, rhinitis")],
        "issues": [("Bronchial Asthma", "8y ago")],
        "chief_complaint": "Acute breathlessness and audible wheezing",
        "symptom_summary": "Known asthmatic with 2 days of worsening wheeze, chest tightness and night-time cough. Reliever inhaler used >6x/day.",
        "acuity": "2", "red_flag": True, "room": "Room 5", "floor": "Floor 2", "token_no": "C-301",
        "vitals": {"bp_sys": 132, "bp_dia": 84, "spo2": 91, "hr": 104, "temp": 98.8, "weight": 68.0, "height": 172.0},
    },
    {
        "first_name": "Meena", "last_name": "Iyer", "dob": date(1979, 7, 11), "gender": "Female",
        "mrn": "MRN-500002", "mobile": "9812300002", "blood_group": "O+", "address": "T. Nagar, Chennai",
        "department": "Endocrinology", "specialty": "Endocrinology",
        "allergies": [],
        "issues": [("Type 2 Diabetes Mellitus", "6y ago"), ("Hypertension", "3y ago")],
        "chief_complaint": "Uncontrolled sugars with fatigue and blurred vision",
        "symptom_summary": "Poorly controlled T2DM on Metformin. Fatigue, blurred vision and tingling feet for 3 weeks. Last HbA1c 9.4%.",
        "acuity": "3", "red_flag": False, "room": "Room 6", "floor": "Floor 2", "token_no": "C-302",
        "vitals": {"bp_sys": 146, "bp_dia": 90, "spo2": 98, "hr": 82, "temp": 98.4, "weight": 74.0, "height": 158.0},
    },
    {
        "first_name": "Suresh", "last_name": "Menon", "dob": date(1962, 12, 5), "gender": "Male",
        "mrn": "MRN-500003", "mobile": "9812300003", "blood_group": "A+", "address": "Banjara Hills, Hyderabad",
        "department": "Cardiology", "specialty": "Cardiology",
        "allergies": [("Aspirin", "nsaid", "MODERATE", "Gastric bleed")],
        "issues": [("Essential Hypertension", "10y ago"), ("Dyslipidaemia", "4y ago")],
        "chief_complaint": "Severe headache with very high blood pressure",
        "symptom_summary": "Throbbing occipital headache and giddiness. Home BP 190/115. Ran out of amlodipine a week ago.",
        "acuity": "2", "red_flag": True, "room": "Room 7", "floor": "Floor 1", "token_no": "C-303",
        "vitals": {"bp_sys": 188, "bp_dia": 112, "spo2": 97, "hr": 92, "temp": 98.6, "weight": 86.0, "height": 174.0},
    },
    {
        "first_name": "Lata", "last_name": "Deshpande", "dob": date(1985, 9, 19), "gender": "Female",
        "mrn": "MRN-500004", "mobile": "9812300004", "blood_group": "AB+", "address": "Kothrud, Pune",
        "department": "Endocrinology", "specialty": "Endocrinology",
        "allergies": [],
        "issues": [("Hypothyroidism", "2y ago")],
        "chief_complaint": "Fatigue, weight gain and cold intolerance",
        "symptom_summary": "Progressive tiredness, 5 kg weight gain, dry skin and constipation over 3 months. On levothyroxine, adherence poor.",
        "acuity": "4", "red_flag": False, "room": "Room 6", "floor": "Floor 2", "token_no": "C-304",
        "vitals": {"bp_sys": 118, "bp_dia": 78, "spo2": 99, "hr": 62, "temp": 97.9, "weight": 71.0, "height": 162.0},
    },
    {
        "first_name": "Arjun", "last_name": "Kapoor", "dob": date(1993, 2, 14), "gender": "Male",
        "mrn": "MRN-500005", "mobile": "9812300005", "blood_group": "O-", "address": "Vasant Kunj, New Delhi",
        "department": "Neurology", "specialty": "Neurology",
        "allergies": [("Codeine", "opioid", "MODERATE", "Severe nausea, rash")],
        "issues": [("Migraine with Aura", "5y ago")],
        "chief_complaint": "Recurrent one-sided headache with visual aura",
        "symptom_summary": "Throbbing left-sided headache preceded by zig-zag visual aura, photophobia and nausea. 3 episodes this week.",
        "acuity": "3", "red_flag": False, "room": "Room 8", "floor": "Floor 2", "token_no": "C-305",
        "vitals": {"bp_sys": 124, "bp_dia": 80, "spo2": 99, "hr": 76, "temp": 98.2, "weight": 77.0, "height": 179.0},
    },
    {
        "first_name": "Fatima", "last_name": "Rizvi", "dob": date(1998, 5, 27), "gender": "Female",
        "mrn": "MRN-500006", "mobile": "9812300006", "blood_group": "B-", "address": "Hazratganj, Lucknow",
        "department": "General Medicine", "specialty": "General Medicine",
        "allergies": [("Ciprofloxacin", "fluoroquinolone", "MILD", "Itching")],
        "issues": [],
        "chief_complaint": "Burning urination and lower abdominal pain",
        "symptom_summary": "Dysuria, urinary frequency and suprapubic discomfort for 2 days. Mild low-grade fever. No flank pain.",
        "acuity": "4", "red_flag": False, "room": "Room 3", "floor": "Floor 1", "token_no": "C-306",
        "vitals": {"bp_sys": 116, "bp_dia": 74, "spo2": 99, "hr": 88, "temp": 99.6, "weight": 55.0, "height": 161.0},
    },
    {
        "first_name": "Deepak", "last_name": "Chauhan", "dob": date(1990, 10, 2), "gender": "Male",
        "mrn": "MRN-500007", "mobile": "9812300007", "blood_group": "A-", "address": "Malviya Nagar, Jaipur",
        "department": "General Medicine", "specialty": "General Medicine",
        "allergies": [],
        "issues": [],
        "chief_complaint": "High fever with severe body and eye pain",
        "symptom_summary": "Sudden high fever (104°F), retro-orbital pain, severe myalgia and a faint rash for 4 days. Dengue-endemic area — watch platelet count.",
        "acuity": "2", "red_flag": True, "room": "Room 4", "floor": "Floor 1", "token_no": "C-307",
        "vitals": {"bp_sys": 104, "bp_dia": 66, "spo2": 97, "hr": 108, "temp": 104.0, "weight": 73.0, "height": 177.0},
    },
    {
        "first_name": "Kavya", "last_name": "Menon", "dob": date(1974, 6, 8), "gender": "Female",
        "mrn": "MRN-500008", "mobile": "9812300008", "blood_group": "O+", "address": "Indiranagar, Bangalore",
        "department": "Orthopaedics", "specialty": "Rheumatology",
        "allergies": [("Sulfasalazine", "sulfa", "MILD", "Skin rash")],
        "issues": [("Rheumatoid Arthritis", "7y ago")],
        "chief_complaint": "Painful, swollen finger and wrist joints",
        "symptom_summary": "Symmetric small-joint pain with morning stiffness >1 hour and visible swelling of MCP and wrist joints. RA flare.",
        "acuity": "3", "red_flag": False, "room": "Room 9", "floor": "Floor 3", "token_no": "C-308",
        "vitals": {"bp_sys": 122, "bp_dia": 78, "spo2": 98, "hr": 80, "temp": 99.1, "weight": 64.0, "height": 160.0},
    },
]


def _wipe_existing(db, first_name: str, last_name: str) -> None:
    existing = db.scalar(
        select(models.Patient)
        .where(models.Patient.first_name == first_name)
        .where(models.Patient.last_name == last_name)
    )
    if not existing:
        return
    for enc in db.scalars(select(models.Encounter).where(models.Encounter.patient_id == existing.patient_id)).all():
        eid = enc.encounter_id
        for order in db.scalars(select(models.LabOrder).where(models.LabOrder.encounter_id == eid)).all():
            db.execute(delete(models.LabResult).where(models.LabResult.lab_order_id == order.lab_order_id))
        db.execute(delete(models.LabOrder).where(models.LabOrder.encounter_id == eid))
        for rx in db.scalars(select(models.Prescription).where(models.Prescription.encounter_id == eid)).all():
            db.execute(delete(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == rx.rx_id))
        db.execute(delete(models.Prescription).where(models.Prescription.encounter_id == eid))
        for inv in db.scalars(select(models.Invoice).where(models.Invoice.encounter_id == eid)).all():
            db.execute(delete(models.InvoiceLine).where(models.InvoiceLine.invoice_id == inv.invoice_id))
            db.execute(delete(models.Payment).where(models.Payment.invoice_id == inv.invoice_id))
            db.execute(delete(models.InsuranceClaim).where(models.InsuranceClaim.invoice_id == inv.invoice_id))
        db.execute(delete(models.Invoice).where(models.Invoice.encounter_id == eid))
        db.execute(delete(models.Triage).where(models.Triage.encounter_id == eid))
        db.execute(delete(models.Vitals).where(models.Vitals.encounter_id == eid))
        db.execute(delete(models.ClinicalNote).where(models.ClinicalNote.encounter_id == eid))
        db.execute(delete(models.Token).where(models.Token.encounter_id == eid))
        db.delete(enc)
    db.execute(delete(models.Allergy).where(models.Allergy.patient_id == existing.patient_id))
    db.execute(delete(models.PatientIssue).where(models.PatientIssue.patient_id == existing.patient_id))
    db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == existing.patient_id))
    db.delete(existing)
    db.flush()


def seed_diverse() -> None:
    print(f"Seeding {len(PATIENTS)} patients across different diseases...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        for p in PATIENTS:
            _wipe_existing(db, p["first_name"], p["last_name"])

            patient = models.Patient(
                first_name=p["first_name"], last_name=p["last_name"], dob=p["dob"], gender=p["gender"],
                mrn=p["mrn"], empi_id=f"EMPI-{p['mrn'][4:]}", mobile=p["mobile"],
                blood_group=p["blood_group"], address=p["address"],
            )
            db.add(patient)
            db.flush()

            for sub, cls, sev, react in p["allergies"]:
                db.add(models.Allergy(patient_id=patient.patient_id, substance=sub, drug_class=cls, severity=sev, reaction=react))

            for name, onset in p["issues"]:
                db.add(models.PatientIssue(patient_id=patient.patient_id, issue_name=name, onset_info=onset, status="ACTIVE"))

            db.add(models.ConsentArtifact(
                patient_id=patient.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
                status="GRANTED", valid_from=now, valid_to=now + timedelta(days=3),
            ))

            enc = models.Encounter(
                patient_id=patient.patient_id, visit_type="OPD", department=p["department"],
                channel="WALKIN", status="TRIAGED", arrival_ts=now - timedelta(minutes=8),
            )
            db.add(enc)
            db.flush()

            v = p["vitals"]
            db.add(models.Vitals(
                encounter_id=enc.encounter_id, bp_systolic=v["bp_sys"], bp_diastolic=v["bp_dia"],
                spo2=v["spo2"], heart_rate=v["hr"], temperature=v["temp"],
                weight_kg=v["weight"], height_cm=v["height"], bmi=round(v["weight"] / ((v["height"] / 100) ** 2), 1),
                captured_ts=now - timedelta(minutes=8),
            ))

            db.add(models.Triage(
                encounter_id=enc.encounter_id, chief_complaint=p["chief_complaint"], symptom_summary=p["symptom_summary"],
                acuity_level=p["acuity"], specialty=p["specialty"], red_flag=p["red_flag"],
            ))

            db.add(models.Token(
                encounter_id=enc.encounter_id, token_number=p["token_no"], department=p["department"],
                room=p["room"], floor=p["floor"], eta_minutes=15, status="WAITING",
            ))

        db.commit()
        conditions = ", ".join(sorted({(x["issues"][0][0] if x["issues"] else x["specialty"]) for x in PATIENTS}))
        print(f"Success: seeded {len(PATIENTS)} patients. Conditions: {conditions}")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_diverse()
