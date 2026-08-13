"""Script to seed 5 diverse patients in the triage queue for testing."""
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select, delete
from app import models
from app.core.database import SessionLocal, init_db

def seed_demo():
    print("Seeding 5 demo patients with clinical profiles...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Patient data
        patients_data = [
            {
                "first_name": "Aarav", "last_name": "Sharma", "dob": date(1990, 8, 15), "gender": "Male",
                "abha": "91-5555-6666-7777", "abha_addr": "aarav.sharma@abdm", "mrn": "MRN-200999",
                "mobile": "9876599999", "blood_group": "B+", "address": "Residency Road, Bangalore",
                "allergies": [("Ibuprofen", "nsaid", "MODERATE", "Bronchospasm, wheezing")],
                "chief_complaint": "High fever and dry cough",
                "symptom_summary": "High-grade fever (102°F) and dry irritating cough for 3 days.",
                "acuity": "3", "red_flag": False, "room": "Room 3", "token_no": "A-060",
                "vitals": {"bp_sys": 120, "bp_dia": 80, "spo2": 97, "hr": 112, "temp": 102.3, "weight": 72.0, "height": 175.0}
            },
            {
                "first_name": "Karan", "last_name": "Johar", "dob": date(1975, 4, 12), "gender": "Male",
                "abha": "91-1111-2222-3333", "abha_addr": "karan.johar@abdm", "mrn": "MRN-200111",
                "mobile": "9876511111", "blood_group": "O-", "address": "Juhu Lane, Mumbai",
                "allergies": [("Amoxicillin", "penicillin", "SEVERE", "Anaphylaxis")],
                "chief_complaint": "Crushing chest pain and breathing difficulty",
                "symptom_summary": "Crushing retrosternal chest pain radiating to left arm. Shortness of breath.",
                "acuity": "2", "red_flag": True, "room": "Room 7", "token_no": "A-061",
                "vitals": {"bp_sys": 148, "bp_dia": 96, "spo2": 93, "hr": 105, "temp": 98.6, "weight": 84.0, "height": 180.0}
            },
            {
                "first_name": "Priya", "last_name": "Patel", "dob": date(1988, 11, 23), "gender": "Female",
                "abha": "91-2222-3333-4444", "abha_addr": "priya.patel@abdm", "mrn": "MRN-200222",
                "mobile": "9876522222", "blood_group": "A+", "address": "Navrangpura, Ahmedabad",
                "allergies": [("Bactrim", "sulfa", "MILD", "Skin rash, hives")],
                "chief_complaint": "Severe burning stomach pain and nausea",
                "symptom_summary": "Burning epigastric pain worse after meals. Occasional acid regurgitation and nausea.",
                "acuity": "4", "red_flag": False, "room": "Room 3", "token_no": "A-062",
                "vitals": {"bp_sys": 112, "bp_dia": 72, "spo2": 99, "hr": 74, "temp": 98.4, "weight": 58.0, "height": 160.0}
            },
            {
                "first_name": "Aditya", "last_name": "Goel", "dob": date(1982, 1, 9), "gender": "Male",
                "abha": "91-3333-4444-5555", "abha_addr": "aditya.goel@abdm", "mrn": "MRN-200333",
                "mobile": "9876533333", "blood_group": "AB+", "address": "GK-2, New Delhi",
                "allergies": [],
                "chief_complaint": "Extreme fatigue, increased thirst, and frequent urination",
                "symptom_summary": "Generalized fatigue for 1 month, accompanied by polyuria and polydipsia. Strong family history of T2DM.",
                "acuity": "3", "red_flag": False, "room": "Room 3", "token_no": "A-063",
                "vitals": {"bp_sys": 128, "bp_dia": 82, "spo2": 98, "hr": 80, "temp": 98.6, "weight": 91.0, "height": 176.0}
            },
            {
                "first_name": "Sneha", "last_name": "Reddy", "dob": date(1995, 6, 30), "gender": "Female",
                "abha": "91-4444-5555-6666", "abha_addr": "sneha.reddy@abdm", "mrn": "MRN-200444",
                "mobile": "9876544444", "blood_group": "O+", "address": "Gachibowli, Hyderabad",
                "allergies": [],
                "chief_complaint": "Sore throat and pain during swallowing",
                "symptom_summary": "Difficulty swallowing, sore throat, and mild body aches for 2 days.",
                "acuity": "4", "red_flag": False, "room": "Room 3", "token_no": "A-064",
                "vitals": {"bp_sys": 118, "bp_dia": 76, "spo2": 99, "hr": 85, "temp": 100.2, "weight": 62.0, "height": 165.0}
            }
        ]
        
        for p_info in patients_data:
            # Delete if exists to make it idempotent
            existing = db.scalar(select(models.Patient).where(models.Patient.first_name == p_info["first_name"]).where(models.Patient.last_name == p_info["last_name"]))
            if existing:
                old_encs = db.scalars(select(models.Encounter).where(models.Encounter.patient_id == existing.patient_id)).all()
                for oe in old_encs:
                    db.execute(delete(models.Triage).where(models.Triage.encounter_id == oe.encounter_id))
                    db.execute(delete(models.Vitals).where(models.Vitals.encounter_id == oe.encounter_id))
                    db.execute(delete(models.Token).where(models.Token.encounter_id == oe.encounter_id))
                    db.execute(delete(models.ClinicalNote).where(models.ClinicalNote.encounter_id == oe.encounter_id))
                    
                    # Delete Lab Results before Lab Orders
                    old_orders = db.scalars(select(models.LabOrder).where(models.LabOrder.encounter_id == oe.encounter_id)).all()
                    for oo in old_orders:
                        db.execute(delete(models.LabResult).where(models.LabResult.lab_order_id == oo.lab_order_id))
                    db.execute(delete(models.LabOrder).where(models.LabOrder.encounter_id == oe.encounter_id))
                    
                    # Delete Prescription Items before Prescriptions
                    old_rxs = db.scalars(select(models.Prescription).where(models.Prescription.encounter_id == oe.encounter_id)).all()
                    for orx in old_rxs:
                        db.execute(delete(models.PrescriptionItem).where(models.PrescriptionItem.rx_id == orx.rx_id))
                    db.execute(delete(models.Prescription).where(models.Prescription.encounter_id == oe.encounter_id))
                    
                    # Delete Invoice children (InvoiceLine, Payment, InsuranceClaim) before Invoices
                    old_invoices = db.scalars(select(models.Invoice).where(models.Invoice.encounter_id == oe.encounter_id)).all()
                    for oinv in old_invoices:
                        db.execute(delete(models.InvoiceLine).where(models.InvoiceLine.invoice_id == oinv.invoice_id))
                        db.execute(delete(models.Payment).where(models.Payment.invoice_id == oinv.invoice_id))
                        db.execute(delete(models.InsuranceClaim).where(models.InsuranceClaim.invoice_id == oinv.invoice_id))
                    db.execute(delete(models.Invoice).where(models.Invoice.encounter_id == oe.encounter_id))
                    
                    db.delete(oe)
                db.execute(delete(models.Allergy).where(models.Allergy.patient_id == existing.patient_id))
                db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == existing.patient_id))
                db.delete(existing)
                db.flush()
            
            # 1. Create Patient
            patient = models.Patient(
                first_name=p_info["first_name"], last_name=p_info["last_name"], dob=p_info["dob"], gender=p_info["gender"],
                abha_number=p_info["abha"], abha_address=p_info["abha_addr"], mrn=p_info["mrn"], empi_id=f"EMPI-{p_info['mrn'][4:]}",
                mobile=p_info["mobile"], blood_group=p_info["blood_group"], address=p_info["address"]
            )
            db.add(patient)
            db.flush()
            
            # 2. Add Allergies
            for sub, d_cls, sev, react in p_info["allergies"]:
                db.add(models.Allergy(patient_id=patient.patient_id, substance=sub, drug_class=d_cls, severity=sev, reaction=react))
            
            # 3. Add Consent
            db.add(models.ConsentArtifact(
                patient_id=patient.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
                status="GRANTED", valid_from=now, valid_to=now + timedelta(days=3)
            ))
            
            # 4. Add Active Triaged Encounter
            enc = models.Encounter(
                patient_id=patient.patient_id, visit_type="OPD", department="General Medicine", channel="WALKIN", status="TRIAGED",
                arrival_ts=now - timedelta(minutes=10)
            )
            db.add(enc)
            db.flush()
            
            # 5. Add Vitals
            v_data = p_info["vitals"]
            db.add(models.Vitals(
                encounter_id=enc.encounter_id, bp_systolic=v_data["bp_sys"], bp_diastolic=v_data["bp_dia"],
                spo2=v_data["spo2"], heart_rate=v_data["hr"], temperature=v_data["temp"],
                weight_kg=v_data["weight"], height_cm=v_data["height"], bmi=round(v_data["weight"] / ((v_data["height"]/100)**2), 1),
                captured_ts=now - timedelta(minutes=10)
            ))
            
            # 6. Add Triage Details
            db.add(models.Triage(
                encounter_id=enc.encounter_id, chief_complaint=p_info["chief_complaint"], symptom_summary=p_info["symptom_summary"],
                acuity_level=p_info["acuity"], specialty="General Medicine", red_flag=p_info["red_flag"]
            ))
            
            # 7. Add Token
            db.add(models.Token(
                encounter_id=enc.encounter_id, token_number=p_info["token_no"], department="General Medicine",
                room=p_info["room"], floor="Floor 2", eta_minutes=15, status="WAITING"
            ))
            
        db.commit()
        print("Success: Seeded 5 demo patients in Doctor queue.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo()
