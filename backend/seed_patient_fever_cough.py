"""Seed script to create a patient with fever and cough in the active queue."""
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select, delete
from app import models
from app.core.database import SessionLocal, init_db

def seed_patient():
    print("Seeding patient with fever and cough...")
    db = SessionLocal()
    try:
        # Check if already exists
        existing = db.scalar(select(models.Patient).where(models.Patient.first_name == "Aarav"))
        if existing:
            # Delete related children records first
            old_encs = db.scalars(select(models.Encounter).where(models.Encounter.patient_id == existing.patient_id)).all()
            for oe in old_encs:
                db.execute(delete(models.Triage).where(models.Triage.encounter_id == oe.encounter_id))
                db.execute(delete(models.Vitals).where(models.Vitals.encounter_id == oe.encounter_id))
                db.execute(delete(models.Token).where(models.Token.encounter_id == oe.encounter_id))
                db.execute(delete(models.ClinicalNote).where(models.ClinicalNote.encounter_id == oe.encounter_id))
                db.execute(delete(models.LabOrder).where(models.LabOrder.encounter_id == oe.encounter_id))
                db.execute(delete(models.Prescription).where(models.Prescription.encounter_id == oe.encounter_id))
                db.delete(oe)
            db.execute(delete(models.Allergy).where(models.Allergy.patient_id == existing.patient_id))
            db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == existing.patient_id))
            db.delete(existing)
            db.flush()

        now = datetime.now(timezone.utc)
        
        # 1. Create Patient
        patient = models.Patient(
            first_name="Aarav",
            last_name="Sharma",
            dob=date(1990, 8, 15),
            gender="Male",
            abha_number="91-5555-6666-7777",
            abha_address="aarav.sharma@abdm",
            mrn="MRN-200999",
            empi_id="EMPI-200999",
            mobile="9876599999",
            blood_group="B+",
            address="45 Residency Road, Bangalore, Karnataka",
        )
        db.add(patient)
        db.flush()
        
        # 2. Add Allergy to NSAIDs (Ibuprofen / Naproxen / Diclofenac)
        db.add(models.Allergy(
            patient_id=patient.patient_id,
            substance="Ibuprofen",
            drug_class="nsaid",
            severity="MODERATE",
            reaction="Bronchospasm, wheezing"
        ))
        
        # 3. Add Consent
        db.add(models.ConsentArtifact(
            patient_id=patient.patient_id,
            purpose="CARE_MGMT",
            hip_id="cliniq-hip",
            hiu_id="cliniq-hiu",
            status="GRANTED",
            valid_from=now,
            valid_to=now + timedelta(days=2)
        ))
        
        # 4. Add Active Triaged Encounter
        enc = models.Encounter(
            patient_id=patient.patient_id,
            visit_type="OPD",
            department="General Medicine",
            channel="WALKIN",
            status="TRIAGED",
            arrival_ts=now - timedelta(minutes=5)
        )
        db.add(enc)
        db.flush()
        
        # 5. Add Vitals (Fever & Tachycardia)
        db.add(models.Vitals(
            encounter_id=enc.encounter_id,
            bp_systolic=120,
            bp_diastolic=80,
            spo2=97,
            heart_rate=112,       # Elevated (Tachycardia)
            temperature=102.3,    # Elevated (High fever)
            weight_kg=72.0,
            height_cm=175.0,
            bmi=23.5,
            captured_ts=now - timedelta(minutes=5)
        ))
        
        # 6. Add Triage Details
        db.add(models.Triage(
            encounter_id=enc.encounter_id,
            chief_complaint="High fever and severe dry cough",
            symptom_summary="Patient reports high-grade fever of 102°F and dry irritating cough for 3 days. Occasional body ache.",
            acuity_level="3",
            specialty="General Medicine",
            red_flag=False
        ))
        
        # 7. Add Token
        db.add(models.Token(
            encounter_id=enc.encounter_id,
            token_number="A-060",
            department="General Medicine",
            room="Room 3",
            floor="Floor 2",
            eta_minutes=15,
            status="WAITING"
        ))
        
        db.commit()
        print("Success: Patient Aarav Sharma created in the queue (Token A-060).")
    finally:
        db.close()

if __name__ == "__main__":
    seed_patient()
