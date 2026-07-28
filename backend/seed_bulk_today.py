"""Bulk-seed the hospital with a large, realistic demo dataset for the Reception /
Command Center / Admin views:

  - At least 100 doctors (`Staff` role=DOCTOR), spread across every specialty already
    used by the AI triage router, so "queue by department" and doctor-pickers have
    real breadth to show.
  - At least 100 patients with full demographic info (name, dob, gender, mobile,
    blood group, address, email, MRN).
  - At least 100 appointments scheduled for TODAY (Asia/Kolkata) — one booking per
    patient, round-robin assigned to doctors — so the Reception "Today's Reception
    Queue & Appointments" hospital-wide list, and the Command Center headline
    metrics, are populated with a busy, realistic day.

Purely additive/idempotent: safe to re-run. Existing rows are never dropped. New
rows created by this script are tagged (hpr_id prefix "HPR-BLK-", mrn prefix
"MRN-BLK-") so re-running only tops up the counts to the targets below instead of
duplicating data.

Run:  cd backend && .venv/bin/python seed_bulk_today.py
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app import models
from app.core.database import SessionLocal, init_db

TARGET_DOCTORS = 100
TARGET_PATIENTS = 100
TARGET_APPOINTMENTS_TODAY = 100

IST = ZoneInfo("Asia/Kolkata")

SPECIALTIES = [
    "General Medicine", "Cardiology", "Pulmonology", "Paediatrics", "Orthopaedics",
    "Dermatology", "Gastroenterology", "Obstetrics & Gynaecology", "Ophthalmology",
    "ENT", "Dentistry", "Psychiatry", "Endocrinology", "Neurology", "Urology",
    "Nephrology", "General Surgery", "Oncology",
]

QUALIFICATIONS = {
    "General Medicine": "MBBS, MD (General Medicine)",
    "Cardiology": "MBBS, MD, DM (Cardiology)",
    "Pulmonology": "MBBS, MD (Pulmonology)",
    "Paediatrics": "MBBS, MD (Paediatrics)",
    "Orthopaedics": "MBBS, MS (Orthopaedics)",
    "Dermatology": "MBBS, MD (Dermatology, Venereology & Leprosy)",
    "Gastroenterology": "MBBS, MD, DM (Gastroenterology)",
    "Obstetrics & Gynaecology": "MBBS, MS (Obstetrics & Gynaecology)",
    "Ophthalmology": "MBBS, MS (Ophthalmology)",
    "ENT": "MBBS, MS (ENT)",
    "Dentistry": "BDS, MDS",
    "Psychiatry": "MBBS, MD (Psychiatry)",
    "Endocrinology": "MBBS, MD, DM (Endocrinology)",
    "Neurology": "MBBS, MD, DM (Neurology)",
    "Urology": "MBBS, MS, MCh (Urology)",
    "Nephrology": "MBBS, MD, DM (Nephrology)",
    "General Surgery": "MBBS, MS (General Surgery)",
    "Oncology": "MBBS, MD, DM (Medical Oncology)",
}

REASONS_BY_SPECIALTY = {
    "General Medicine": "Routine consultation and general check-up",
    "Cardiology": "Follow-up for hypertension / chest discomfort",
    "Pulmonology": "Persistent cough and breathing difficulty",
    "Paediatrics": "Child wellness / vaccination visit",
    "Orthopaedics": "Joint pain and mobility assessment",
    "Dermatology": "Skin rash and allergy consultation",
    "Gastroenterology": "Abdominal pain and digestive issues",
    "Obstetrics & Gynaecology": "Antenatal check-up",
    "Ophthalmology": "Vision check and eye discomfort",
    "ENT": "Throat infection and hearing check",
    "Dentistry": "Dental pain and routine cleaning",
    "Psychiatry": "Anxiety and sleep counselling",
    "Endocrinology": "Diabetes / thyroid follow-up",
    "Neurology": "Recurrent headaches / migraine review",
    "Urology": "Urinary discomfort follow-up",
    "Nephrology": "Kidney function follow-up",
    "General Surgery": "Pre-operative surgical consultation",
    "Oncology": "Oncology follow-up review",
}

DOCTOR_FIRST_NAMES = [
    "Aditi", "Rahul", "Sneha", "Vikas", "Pooja", "Manish", "Ritu", "Anil", "Sanya", "Deepak",
    "Kiran", "Vivek", "Meenal", "Rajat", "Shreya", "Ajay", "Neelam", "Gaurav", "Isha", "Nitin",
    "Priyanka", "Suresh", "Radhika", "Ashok", "Tanvi", "Mohit", "Swati", "Rakesh", "Divya", "Sameer",
    "Anjali", "Kunal", "Preeti", "Vishal", "Kavya", "Alok", "Namrata", "Yogesh", "Simran", "Harish",
    "Bhavna", "Prakash", "Rekha", "Naveen", "Shalini", "Tarun", "Vidya", "Ravindra", "Megha", "Sandeep",
]
DOCTOR_LAST_NAMES = [
    "Kulkarni", "Bhatt", "Trivedi", "Nair", "Chatterjee", "Das", "Mukherjee", "Bose", "Sinha", "Kapadia",
    "Rathi", "Bhandari", "Rawal", "Deshpande", "Kaur", "Sethi", "Grover", "Ranganathan", "Subramaniam", "Iyengar",
    "Pandey", "Mishra", "Tripathi", "Bajaj", "Chawla", "Malhotra", "Khanna", "Arora", "Chopra", "Saxena",
]

PATIENT_FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
    "Ananya", "Diya", "Aadhya", "Kiara", "Myra", "Saanvi", "Anika", "Riya", "Ira", "Prisha",
    "Mohammed", "Zara", "Aisha", "Imran", "Fatima", "Sameera", "Omar", "Ayaan", "Sara", "Nadia",
    "Gurpreet", "Simranjit", "Harman", "Jaspreet", "Manpreet", "Amrit", "Karan", "Tejinder", "Baljeet", "Rajwinder",
    "Lakshmi", "Ganesh", "Vani", "Ramesh", "Padma", "Suresh", "Kavitha", "Murali", "Deepa", "Venkatesh",
    "Farah", "Aryan", "Naina", "Rudra", "Tara", "Yash", "Zoya", "Dev", "Mira", "Kabir",
]
PATIENT_LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Reddy", "Rao", "Nair", "Menon", "Iyer",
    "Patel", "Shah", "Mehta", "Joshi", "Desai", "Pillai", "Chandran", "Krishnan", "Bhatt", "Bose",
    "Khan", "Ansari", "Sheikh", "Qureshi", "Siddiqui", "Kaur", "Gill", "Sandhu", "Dhillon", "Bajwa",
    "Pandey", "Mishra", "Tiwari", "Dubey", "Chaturvedi", "Bhandari", "Rawat", "Negi", "Thakur", "Chauhan",
]
CITIES = [
    "Andheri, Mumbai", "Koramangala, Bangalore", "Banjara Hills, Hyderabad", "Salt Lake, Kolkata",
    "T Nagar, Chennai", "Vasant Kunj, New Delhi", "Baner, Pune", "Navrangpura, Ahmedabad",
    "Indiranagar, Bangalore", "Malad, Mumbai", "Gachibowli, Hyderabad", "Alkapuri, Vadodara",
    "Sector 62, Noida", "MG Road, Gurugram", "Kothrud, Pune", "Anna Nagar, Chennai",
    "Viman Nagar, Pune", "Powai, Mumbai", "Jayanagar, Bangalore", "Vastrapur, Ahmedabad",
]
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
GENDERS = ["Male", "Female"]
CHANNELS = ["APP", "WALKIN", "PORTAL", "WHATSAPP"]


def _rand_dob(rng: random.Random) -> date:
    age_years = rng.randint(4, 82)
    today = date.today()
    try:
        return today.replace(year=today.year - age_years)
    except ValueError:  # Feb 29 on a non-leap year
        return today.replace(year=today.year - age_years, day=28)


def seed_doctors(db, rng: random.Random) -> list[models.Staff]:
    existing = db.scalars(select(models.Staff).where(models.Staff.role == "DOCTOR")).all()
    existing_names = {d.name for d in existing}
    count = len(existing)
    print(f"Existing doctors: {count} (target {TARGET_DOCTORS})")

    max_hpr = db.scalar(select(func.count()).select_from(models.Staff))
    new_index = 0
    added: list[models.Staff] = []
    spec_cycle = 0
    while count + len(added) < TARGET_DOCTORS:
        first = rng.choice(DOCTOR_FIRST_NAMES)
        last = rng.choice(DOCTOR_LAST_NAMES)
        name = f"Dr. {first} {last}"
        if name in existing_names:
            new_index += 1
            continue
        existing_names.add(name)
        spec = SPECIALTIES[spec_cycle % len(SPECIALTIES)]
        spec_cycle += 1
        staff = models.Staff(
            hpr_id=f"HPR-BLK-{max_hpr + new_index + 1:04d}",
            name=name,
            role="DOCTOR",
            department=spec,
            specialty=spec,
            available=True,
            experience_years=rng.randint(3, 28),
            room=f"Room {201 + new_index}",
            floor=f"Floor {2 + (new_index // 6)}",
            access_pin="1234",
            opd_fee=float(rng.choice([400, 500, 600, 700, 800, 900])),
            qualifications=QUALIFICATIONS[spec],
        )
        db.add(staff)
        added.append(staff)
        new_index += 1
    db.flush()
    print(f"Added {len(added)} new doctors.")
    return db.scalars(select(models.Staff).where(models.Staff.role == "DOCTOR")).all()


def seed_patients(db, rng: random.Random) -> list[models.Patient]:
    existing = db.scalars(select(models.Patient)).all()
    count = len(existing)
    print(f"Existing patients: {count} (target {TARGET_PATIENTS})")

    existing_mobiles = {p.mobile for p in existing if p.mobile}
    max_mrn = db.scalar(
        select(func.count()).select_from(models.Patient).where(models.Patient.mrn.isnot(None))
    ) or 0

    added: list[models.Patient] = []
    i = 0
    while count + len(added) < TARGET_PATIENTS:
        first = rng.choice(PATIENT_FIRST_NAMES)
        last = rng.choice(PATIENT_LAST_NAMES)
        mobile = f"70000{(max_mrn + i):05d}"
        if mobile in existing_mobiles:
            i += 1
            continue
        existing_mobiles.add(mobile)
        gender = rng.choice(GENDERS)
        patient = models.Patient(
            mrn=f"MRN-BLK-{max_mrn + i + 1:05d}",
            first_name=first,
            last_name=last,
            dob=_rand_dob(rng),
            gender=gender,
            mobile=mobile,
            email=f"{first.lower()}.{last.lower()}{max_mrn + i}@example.com",
            blood_group=rng.choice(BLOOD_GROUPS),
            address=rng.choice(CITIES),
        )
        db.add(patient)
        added.append(patient)
        i += 1
    db.flush()
    print(f"Added {len(added)} new patients.")
    return db.scalars(select(models.Patient)).all()


def seed_today_appointments(db, rng: random.Random, doctors: list[models.Staff], patients: list[models.Patient]) -> int:
    today = datetime.now(IST).date()
    day_start_utc = datetime.combine(today, time.min, tzinfo=IST)

    existing_today = db.scalars(
        select(models.Appointment)
        .where(models.Appointment.scheduled_start >= day_start_utc.astimezone(ZoneInfo("UTC")))
        .where(models.Appointment.scheduled_start < (day_start_utc + timedelta(days=1)).astimezone(ZoneInfo("UTC")))
    ).all()
    print(f"Existing appointments today: {len(existing_today)} (target {TARGET_APPOINTMENTS_TODAY})")

    already_booked_patient_ids = {a.patient_id for a in existing_today}
    candidates = [p for p in patients if p.patient_id not in already_booked_patient_ids]
    needed = max(0, TARGET_APPOINTMENTS_TODAY - len(existing_today))
    rng.shuffle(candidates)
    chosen = candidates[:needed]

    statuses = (["BOOKED"] * 6) + (["CHECKED_IN"] * 2) + (["COMPLETED"] * 2)  # 60/20/20 mix
    added = 0
    for i, patient in enumerate(chosen):
        doctor = doctors[i % len(doctors)]
        spec = doctor.specialty or "General Medicine"
        hour = 8 + (i % 11)  # spread across 08:00 - 18:00 IST
        minute = (i * 7) % 60
        start_local = datetime.combine(today, time(hour=hour, minute=minute), tzinfo=IST)
        status = statuses[i % len(statuses)]
        appt = models.Appointment(
            patient_id=patient.patient_id,
            doctor_id=doctor.staff_id,
            department=doctor.department,
            specialty=spec,
            reason=REASONS_BY_SPECIALTY.get(spec, "General consultation"),
            appointment_type="OPD",
            scheduled_start=start_local.astimezone(ZoneInfo("UTC")),
            scheduled_end=(start_local + timedelta(minutes=20)).astimezone(ZoneInfo("UTC")),
            status=status,
            channel=rng.choice(CHANNELS),
        )
        db.add(appt)
        added += 1
    db.flush()
    print(f"Added {added} new appointments for today.")
    return len(existing_today) + added


def main() -> None:
    init_db()
    db = SessionLocal()
    rng = random.Random(20260723)  # deterministic, reproducible demo data
    try:
        doctors = seed_doctors(db, rng)
        patients = seed_patients(db, rng)
        seed_today_appointments(db, rng, doctors, patients)
        db.commit()
        print("Done. Totals -> doctors:", len(doctors), "patients:", len(patients))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
