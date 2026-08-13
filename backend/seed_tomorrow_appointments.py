"""Register 25 patients with CONFIRMED appointments for TOMORROW.

Creates 25 patients (idempotent by MRN) each with a portal appointment scheduled
for the next calendar day, spread across specialty-matched doctors in 20-minute
slots from 09:00 IST. Re-run safe: wipes prior MRN-APT-* patients + their
appointments/consent before recreating.

Run:  cd backend && DATABASE_URL='sqlite:////abs/backend/cliniq_demo.db' \\
          .venv/bin/python seed_tomorrow_appointments.py
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select

from app import models
from app.core.database import SessionLocal, init_db

IST = ZoneInfo("Asia/Kolkata")

# (first, last, dob, gender, mobile, specialty, reason)
PATIENTS = [
    ("Ananya", "Rao", date(1991, 3, 12), "Female", "9800000001", "Cardiology", "Palpitations and chest discomfort review"),
    ("Vikas", "Malhotra", date(1966, 7, 8), "Male", "9800000002", "Endocrinology", "Diabetes follow-up and HbA1c review"),
    ("Sneha", "Pillai", date(1994, 1, 25), "Female", "9800000003", "Pulmonology", "Chronic cough evaluation"),
    ("Rohit", "Sinha", date(1988, 9, 3), "Male", "9800000004", "Neurology", "Recurrent headache assessment"),
    ("Kavya", "Nair", date(1999, 5, 17), "Female", "9800000005", "Dermatology", "Persistent acne and rash"),
    ("Aman", "Verma", date(1979, 11, 29), "Male", "9800000006", "Orthopaedics", "Knee pain and stiffness"),
    ("Divya", "Menon", date(1985, 2, 14), "Female", "9800000007", "Gastroenterology", "Acid reflux and bloating"),
    ("Karthik", "Reddy", date(1973, 6, 21), "Male", "9800000008", "General Medicine", "Annual health check-up"),
    ("Ishaan", "Gupta", date(2016, 8, 9), "Male", "9800000009", "Paediatrics", "Child vaccination and growth check"),
    ("Meera", "Joshi", date(1961, 12, 2), "Female", "9800000010", "Cardiology", "Hypertension medication review"),
    ("Arnav", "Bose", date(1996, 4, 6), "Male", "9800000011", "Pulmonology", "Asthma inhaler technique review"),
    ("Riya", "Kapoor", date(1992, 10, 19), "Female", "9800000012", "Dermatology", "Hair loss consultation"),
    ("Sameer", "Khan", date(1983, 3, 30), "Male", "9800000013", "Endocrinology", "Thyroid function review"),
    ("Tanvi", "Desai", date(1990, 7, 11), "Female", "9800000014", "Neurology", "Migraine prophylaxis review"),
    ("Nikhil", "Rao", date(1977, 1, 8), "Male", "9800000015", "Orthopaedics", "Lower back pain evaluation"),
    ("Ayesha", "Sheikh", date(1995, 9, 23), "Female", "9800000016", "General Medicine", "Fatigue and anaemia workup"),
    ("Rahul", "Chettri", date(1969, 5, 4), "Male", "9800000017", "Gastroenterology", "Chronic constipation review"),
    ("Pooja", "Iyer", date(1987, 2, 27), "Female", "9800000018", "Cardiology", "ECG and lipid profile review"),
    ("Dev", "Patel", date(2001, 11, 15), "Male", "9800000019", "General Medicine", "Seasonal flu symptoms"),
    ("Sara", "Thomas", date(1993, 6, 30), "Female", "9800000020", "Dermatology", "Eczema follow-up"),
    ("Manish", "Agarwal", date(1975, 8, 18), "Male", "9800000021", "Endocrinology", "Obesity and metabolic review"),
    ("Neha", "Kulkarni", date(2014, 3, 9), "Female", "9800000022", "Paediatrics", "Child fever follow-up"),
    ("Yash", "Mehta", date(1990, 12, 12), "Male", "9800000023", "Orthopaedics", "Shoulder injury review"),
    ("Farida", "Begum", date(1958, 4, 21), "Female", "9800000024", "Pulmonology", "COPD review"),
    ("Aditya", "Nair", date(1982, 10, 5), "Male", "9800000025", "General Medicine", "Blood pressure check"),
]

BLOOD = ["A+", "B+", "O+", "AB+", "A-", "O-"]


def _wipe(db, mrn: str) -> None:
    p = db.scalar(select(models.Patient).where(models.Patient.mrn == mrn))
    if not p:
        return
    db.execute(delete(models.Appointment).where(models.Appointment.patient_id == p.patient_id))
    db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == p.patient_id))
    db.delete(p)
    db.flush()


def seed_tomorrow() -> None:
    tomorrow = date.today() + timedelta(days=1)
    print(f"Registering {len(PATIENTS)} patients for appointments on {tomorrow.isoformat()}...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        doctors = db.scalars(select(models.Staff).where(models.Staff.role == "DOCTOR")).all()
        if not doctors:
            print("No doctors found — run the core seed first.")
            return
        by_spec: dict[str, list] = {}
        for d in doctors:
            by_spec.setdefault(d.specialty, []).append(d)

        base = datetime.combine(tomorrow, time(9, 0), tzinfo=IST)
        slot_index: dict[str, int] = {}  # per-doctor 20-min slot counter
        rr = 0  # round-robin fallback pointer

        created = 0
        for i, (fn, ln, dob, gen, mob, spec, reason) in enumerate(PATIENTS):
            mrn = f"MRN-APT-{i + 1:03d}"
            _wipe(db, mrn)

            patient = models.Patient(
                first_name=fn, last_name=ln, dob=dob, gender=gen, mrn=mrn,
                empi_id=f"EMPI-{mrn[4:]}", mobile=mob, blood_group=BLOOD[i % len(BLOOD)],
            )
            db.add(patient)
            db.flush()

            db.add(models.ConsentArtifact(
                patient_id=patient.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
                status="GRANTED", valid_from=now, valid_to=now + timedelta(days=2),
            ))

            candidates = by_spec.get(spec)
            if candidates:
                doc = candidates[slot_index.get(spec, 0) % len(candidates)]
            else:
                doc = doctors[rr % len(doctors)]
                rr += 1

            n = slot_index.get(doc.staff_id, 0)
            slot_index[doc.staff_id] = n + 1
            slot_index[spec] = slot_index.get(spec, 0) + 1
            start = base + timedelta(minutes=20 * n)

            db.add(models.Appointment(
                patient_id=patient.patient_id, doctor_id=doc.staff_id,
                department=spec, specialty=spec, reason=reason,
                appointment_type="OPD", status="BOOKED", channel="PORTAL",
                scheduled_start=start, scheduled_end=start + timedelta(minutes=20),
            ))
            created += 1

        db.commit()
        print(f"Success: registered {created} patients with BOOKED appointments for {tomorrow.isoformat()}.")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_tomorrow()
