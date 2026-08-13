"""Seed the database with staff (doctors and triage nurses) and pharmacy stock only.

Run once:  python -m app.seed --force
"""
from __future__ import annotations

import sys
from datetime import date, timezone
from sqlalchemy import select

from app import models
from app.core.database import SessionLocal, init_db, engine, Base


def seed() -> None:
    if "--force" in sys.argv:
        import app.models  # Ensure all models are registered
        Base.metadata.drop_all(bind=engine)
        print("Dropped all tables for clean reseed.")
        
    init_db()
    db = SessionLocal()
    
    try:
        # ---------------------------------------------------------------- Staff (doctors)
        doctors_data = [
            ("Dr. Ananya Mehta", "General Medicine"),
            ("Dr. Rohan Verma", "General Medicine"),
            ("Dr. Vikram Rao", "Cardiology"),
            ("Dr. Kavita Joshi", "Cardiology"),
            ("Dr. Priya Iyer", "Pulmonology"),
            ("Dr. Sanjay Gupta", "Pulmonology"),
            ("Dr. Sameer Kapoor", "Paediatrics"),
            ("Dr. Ritu Malhotra", "Paediatrics"),
            ("Dr. Neha Nair", "Orthopaedics"),
            ("Dr. Arvind Menon", "Orthopaedics"),
            ("Dr. Arjun Shah", "Dermatology"),
            ("Dr. Divya Reddy", "Dermatology"),
            ("Dr. Nisha Rao", "Oncology"),
            ("Dr. Arvind Khanna", "Oncology"),
            ("Dr. Kavita Iyer", "Oncology"),
        ]
        
        doctor_by_name: dict[str, models.Staff] = {}
        for i, (name, spec) in enumerate(doctors_data):
            staff = models.Staff(
                hpr_id=f"HPR-{1000 + i}",
                name=name,
                role="DOCTOR",
                department=spec,
                specialty=spec,
                available=True,
                experience_years=6 + (i % 6) * 3,
                room=f"Room {101 + i}",
                floor=f"Floor {1 + (i // 4)}",
                access_pin="1234",
                opd_fee=400.0 + (i % 6) * 100.0,
            )
            db.add(staff)
            doctor_by_name[name] = staff

        # ---------------------------------------------------------------- Staff (2 Triage Nurses)
        db.add(models.Staff(
            hpr_id="HPR-2001",
            name="Priya Sharma",
            role="NURSE",
            department="Triage",
            specialty="Triage Nursing",
            available=True,
            experience_years=6,
            room="Triage Room 1",
            floor="Ground Floor",
            access_pin="1234",
            opd_fee=0.0,
        ))

        db.add(models.Staff(
            hpr_id="HPR-2002",
            name="Amit Patel",
            role="NURSE",
            department="Triage",
            specialty="Triage Nursing",
            available=True,
            experience_years=4,
            room="Triage Room 2",
            floor="Ground Floor",
            access_pin="1234",
            opd_fee=0.0,
        ))

        # ---------------------------------------------------------------- Pharmacy stock catalog
        stock = [
            ("Azithromycin 500mg", "Azithromycin", "macrolide", 120, 18.0, True),
            ("Amoxicillin 500mg", "Amoxicillin", "penicillin", 80, 12.0, True),
            ("Cefixime 200mg", "Cefixime", "cephalosporin", 90, 15.0, True),
            ("Paracetamol 650mg", "Paracetamol", "analgesic", 500, 2.0, True),
            ("Ibuprofen 400mg", "Ibuprofen", "nsaid", 300, 3.0, True),
            ("Amlodipine 5mg", "Amlodipine", "ccb", 200, 3.0, True),
            ("Metformin 500mg", "Metformin", "biguanide", 300, 2.0, True),
            ("Pantoprazole 40mg", "Pantoprazole", "ppi", 150, 4.0, True),
            ("Cetirizine 10mg", "Cetirizine", "antihistamine", 150, 5.0, True),
            ("Dextromethorphan Syrup X", "Dextromethorphan", "antitussive", 0, 60.0, True),
            ("Dextromethorphan Syrup Y", "Dextromethorphan", "antitussive", 60, 55.0, True),
            ("Insulin Glargine", "Insulin Glargine", "insulin", 8, 320.0, True),
        ]
        for name, salt, cls, qty, price, form in stock:
            db.add(models.PharmacyStock(
                drug_name=name, salt=salt, drug_class=cls, quantity_available=qty,
                unit_price=price, formulary=form, batch="B-2026-01",
                expiry_date=date(2027, 12, 31), location="Pharmacy 1",
            ))

        db.flush()

        # ---------------------------------------------------------------- Doctor Schedules (10 AM to 8 PM)
        seeded_doctors = db.scalars(select(models.Staff).where(models.Staff.role == "DOCTOR")).all()
        for index, doctor in enumerate(seeded_doctors):
            # Seed schedule for Monday (0) to Sunday (6)
            for day in range(0, 7):
                db.add(models.DoctorSchedule(
                    doctor_id=doctor.staff_id,
                    day_of_week=day,
                    start_time="10:00",
                    end_time="20:00",
                    slot_duration_minutes=15,
                    department=doctor.department,
                    location="OPD Block",
                    room=doctor.room or f"Room {index + 1}",
                    active=True,
                ))

        db.commit()
        print("Database seeded with Staff, Schedules, and Pharmacy Stock only.")
        print(f"  Doctors seeded  : {len(doctors_data)}")
        print(f"  Nurses seeded   : 2 (Priya Sharma, Amit Patel)")
        print(f"  Schedules seeded: Mon-Sun 10:00 AM - 8:00 PM for each doctor")
        print(f"  Stock catalog   : {len(stock)} items")

        # Inventory / supply-chain domain (idempotent).
        from seed_inventory import seed_inventory
        seed_inventory(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
