"""Script to seed 3 demo oncology patients (diagnosis, biomarkers, chemo regimen/cycles,
tumor board case, radiology/pathology reports, survivorship plan) for the cancer-care module.
Idempotent: re-running deletes and recreates the same 3 patients by name.
"""
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select, delete
from app import models
from app.core.database import SessionLocal, init_db


def _wipe_existing(db, first_name: str, last_name: str) -> None:
    existing = db.scalar(
        select(models.Patient).where(models.Patient.first_name == first_name, models.Patient.last_name == last_name)
    )
    if not existing:
        return
    pid = existing.patient_id
    diagnoses = db.scalars(select(models.Diagnosis).where(models.Diagnosis.patient_id == pid)).all()
    for dx in diagnoses:
        regimens = db.scalars(select(models.ChemoRegimen).where(models.ChemoRegimen.diagnosis_id == dx.diagnosis_id)).all()
        for reg in regimens:
            db.execute(delete(models.ChemoCycle).where(models.ChemoCycle.regimen_id == reg.regimen_id))
        db.execute(delete(models.ChemoRegimen).where(models.ChemoRegimen.diagnosis_id == dx.diagnosis_id))
        db.execute(delete(models.BiomarkerTest).where(models.BiomarkerTest.diagnosis_id == dx.diagnosis_id))
        db.execute(delete(models.TumorBoardCase).where(models.TumorBoardCase.diagnosis_id == dx.diagnosis_id))
        db.execute(delete(models.SurvivorshipPlan).where(models.SurvivorshipPlan.diagnosis_id == dx.diagnosis_id))
    db.execute(delete(models.RadiologyReport).where(models.RadiologyReport.patient_id == pid))
    db.execute(delete(models.PathologyReport).where(models.PathologyReport.patient_id == pid))
    db.execute(delete(models.Diagnosis).where(models.Diagnosis.patient_id == pid))
    db.execute(delete(models.Allergy).where(models.Allergy.patient_id == pid))
    db.execute(delete(models.ConsentArtifact).where(models.ConsentArtifact.patient_id == pid))
    db.delete(existing)
    db.flush()


def seed_oncology_demo():
    print("Seeding 3 demo oncology patients...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        today = date.today()

        # ---------------------------------------------------------------- Patient 1: active chemo
        _wipe_existing(db, "Meera", "Krishnan")
        p1 = models.Patient(
            first_name="Meera", last_name="Krishnan", dob=date(1978, 3, 22), gender="Female",
            abha_number="91-7001-1001-1001", abha_address="meera.krishnan@abdm", mrn="MRN-300001",
            empi_id="EMPI-300001", mobile="9876600001", blood_group="B+", address="Malleswaram, Bangalore",
        )
        db.add(p1)
        db.flush()
        db.add(models.ConsentArtifact(
            patient_id=p1.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
            status="GRANTED", valid_from=now, valid_to=now + timedelta(days=180),
        ))
        dx1 = models.Diagnosis(
            patient_id=p1.patient_id, cancer_type="Breast", primary_site="Left breast, upper outer quadrant",
            histology="Invasive ductal carcinoma", icd10_code="C50.9", icdo_morphology_code="8500/3",
            grade="G2", stage_group="Stage IIB", tnm_t="T2", tnm_n="N1", tnm_m="M0", metastatic=False,
            diagnosed_by=None, diagnosed_date=today - timedelta(days=70), status="ACTIVE",
            notes="Diagnosed via core needle biopsy after screening mammogram flagged a 3.2cm mass.",
        )
        db.add(dx1)
        db.flush()
        for marker, result, value, method in [
            ("ER", "POSITIVE", "95%", "IHC"),
            ("PR", "POSITIVE", "80%", "IHC"),
            ("HER2", "NEGATIVE", "1+", "IHC"),
            ("Ki-67", "POSITIVE", "28%", "IHC"),
        ]:
            db.add(models.BiomarkerTest(
                diagnosis_id=dx1.diagnosis_id, patient_id=p1.patient_id, marker_name=marker,
                result=result, value=value, method=method, lab_name="ClinIQ Molecular Diagnostics Lab",
                tested_date=today - timedelta(days=65),
            ))
        reg1 = models.ChemoRegimen(
            diagnosis_id=dx1.diagnosis_id, patient_id=p1.patient_id, protocol_name="AC-T",
            intent="ADJUVANT", line_of_therapy=1,
            drugs=[
                {"name": "Doxorubicin", "dose": "60 mg/m2", "route": "IV"},
                {"name": "Cyclophosphamide", "dose": "600 mg/m2", "route": "IV"},
            ],
            cycle_length_days=21, planned_cycles=4, prescribed_by=None,
            start_date=today - timedelta(days=42), status="ACTIVE",
        )
        db.add(reg1)
        db.flush()
        cycle_plan = [
            (1, today - timedelta(days=42), "ADMINISTERED", None),
            (2, today - timedelta(days=21), "ADMINISTERED", None),
            (3, today + timedelta(days=0), "SCHEDULED", None),
            (4, today + timedelta(days=21), "SCHEDULED", None),
        ]
        for cycle_number, sched, status, delay_reason in cycle_plan:
            db.add(models.ChemoCycle(
                regimen_id=reg1.regimen_id, cycle_number=cycle_number, scheduled_date=sched,
                administered_date=sched if status == "ADMINISTERED" else None, status=status,
                delay_reason=delay_reason, weight_kg=64.0, bsa_m2=1.68,
                toxicities=[{"ctcae_term": "Nausea", "grade": 1}] if status == "ADMINISTERED" else [],
                administered_by=None,
            ))
        db.add(models.TumorBoardCase(
            diagnosis_id=dx1.diagnosis_id, patient_id=p1.patient_id,
            scheduled_date=today - timedelta(days=68),
            attendees=[
                {"name": "Dr. Nisha Rao", "specialty": "Surgical Oncology"},
                {"name": "Dr. Arvind Menon", "specialty": "Medical Oncology"},
                {"name": "Dr. Kavita Iyer", "specialty": "Radiation Oncology"},
            ],
            case_summary="42yo female, T2N1M0 invasive ductal carcinoma, ER/PR+ HER2-.",
            recommendation="Neoadjuvant not indicated; proceed to adjuvant AC-T chemotherapy followed by "
                           "hormonal therapy and adjuvant radiotherapy.",
            status="DISCUSSED",
        ))
        db.add(models.PathologyReport(
            patient_id=p1.patient_id, diagnosis_id=dx1.diagnosis_id, specimen_type="CORE",
            specimen_site="Left breast, upper outer quadrant", diagnosis_text="Invasive ductal carcinoma, grade 2.",
            margins_status="CLEAR", lymph_nodes_examined=0, lymph_nodes_positive=0,
            reported_ts=now - timedelta(days=65),
        ))

        # ------------------------------------------------------------- Patient 2: newly diagnosed
        _wipe_existing(db, "Rajesh", "Kumar")
        p2 = models.Patient(
            first_name="Rajesh", last_name="Kumar", dob=date(1965, 11, 5), gender="Male",
            abha_number="91-7002-1002-1002", abha_address="rajesh.kumar@abdm", mrn="MRN-300002",
            empi_id="EMPI-300002", mobile="9876600002", blood_group="O+", address="Vashi, Navi Mumbai",
        )
        db.add(p2)
        db.flush()
        db.add(models.ConsentArtifact(
            patient_id=p2.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
            status="GRANTED", valid_from=now, valid_to=now + timedelta(days=180),
        ))
        dx2 = models.Diagnosis(
            patient_id=p2.patient_id, cancer_type="Lung (NSCLC)", primary_site="Right upper lobe",
            histology="Adenocarcinoma", icd10_code="C34.1", icdo_morphology_code="8140/3", grade="G3",
            stage_group="Stage IV", tnm_t="T3", tnm_n="N2", tnm_m="M1a", metastatic=True,
            metastatic_sites=["Contralateral lung nodules", "Pleural effusion"],
            diagnosed_by=None, diagnosed_date=today - timedelta(days=12), status="ACTIVE",
            notes="Presented with persistent cough and weight loss; CT-guided biopsy confirmed adenocarcinoma.",
        )
        db.add(dx2)
        db.flush()
        for marker, result, value, method in [
            ("EGFR", "MUTATED", "Exon 19 deletion", "NGS"),
            ("ALK", "NEGATIVE", "-", "FISH"),
            ("PD-L1", "POSITIVE", "TPS 60%", "IHC"),
        ]:
            db.add(models.BiomarkerTest(
                diagnosis_id=dx2.diagnosis_id, patient_id=p2.patient_id, marker_name=marker,
                result=result, value=value, method=method, lab_name="ClinIQ Molecular Diagnostics Lab",
                tested_date=today - timedelta(days=8),
            ))
        db.add(models.TumorBoardCase(
            diagnosis_id=dx2.diagnosis_id, patient_id=p2.patient_id,
            scheduled_date=today + timedelta(days=3),
            attendees=[
                {"name": "Dr. Arvind Menon", "specialty": "Medical Oncology"},
                {"name": "Dr. Kavita Iyer", "specialty": "Radiation Oncology"},
                {"name": "Dr. Sameer Vora", "specialty": "Pulmonology"},
            ],
            case_summary="60yo male, stage IV NSCLC (adenocarcinoma), EGFR exon 19 deletion positive, "
                         "contralateral lung + pleural metastases.",
            status="SCHEDULED",
        ))
        db.add(models.RadiologyReport(
            patient_id=p2.patient_id, diagnosis_id=dx2.diagnosis_id, modality="PET-CT", body_region="Whole body",
            findings="Hypermetabolic 4.1cm mass in right upper lobe with FDG-avid contralateral pulmonary "
                     "nodules and moderate right pleural effusion.",
            impression="Stage IV NSCLC with pulmonary and pleural metastases.", recist_response=None,
            reported_ts=now - timedelta(days=10),
        ))
        db.add(models.PathologyReport(
            patient_id=p2.patient_id, diagnosis_id=dx2.diagnosis_id, specimen_type="CORE",
            specimen_site="Right upper lobe lung mass", diagnosis_text="Adenocarcinoma, poorly differentiated.",
            margins_status=None, lymph_nodes_examined=0, lymph_nodes_positive=0,
            reported_ts=now - timedelta(days=11),
        ))

        # ---------------------------------------------------------- Patient 3: post-treatment survivor
        _wipe_existing(db, "Anjali", "Verma")
        p3 = models.Patient(
            first_name="Anjali", last_name="Verma", dob=date(1970, 7, 18), gender="Female",
            abha_number="91-7003-1003-1003", abha_address="anjali.verma@abdm", mrn="MRN-300003",
            empi_id="EMPI-300003", mobile="9876600003", blood_group="A+", address="Indiranagar, Bangalore",
        )
        db.add(p3)
        db.flush()
        db.add(models.ConsentArtifact(
            patient_id=p3.patient_id, purpose="CARE_MGMT", hip_id="cliniq-hip", hiu_id="cliniq-hiu",
            status="GRANTED", valid_from=now, valid_to=now + timedelta(days=365),
        ))
        dx3 = models.Diagnosis(
            patient_id=p3.patient_id, cancer_type="Colorectal", primary_site="Sigmoid colon",
            histology="Adenocarcinoma", icd10_code="C18.7", icdo_morphology_code="8140/3", grade="G2",
            stage_group="Stage III", tnm_t="T3", tnm_n="N1", tnm_m="M0", metastatic=False,
            diagnosed_by=None, diagnosed_date=today - timedelta(days=420), status="REMISSION",
            notes="Underwent sigmoidectomy followed by 6 cycles of adjuvant FOLFOX. Currently in remission.",
        )
        db.add(dx3)
        db.flush()
        reg3 = models.ChemoRegimen(
            diagnosis_id=dx3.diagnosis_id, patient_id=p3.patient_id, protocol_name="FOLFOX",
            intent="ADJUVANT", line_of_therapy=1,
            drugs=[
                {"name": "Oxaliplatin", "dose": "85 mg/m2", "route": "IV"},
                {"name": "Leucovorin", "dose": "400 mg/m2", "route": "IV"},
                {"name": "5-Fluorouracil", "dose": "400 mg/m2 bolus + 2400 mg/m2 infusion", "route": "IV"},
            ],
            cycle_length_days=14, planned_cycles=6, prescribed_by=None,
            start_date=today - timedelta(days=390), end_date=today - timedelta(days=310), status="COMPLETED",
        )
        db.add(reg3)
        db.flush()
        for cycle_number in range(1, 7):
            sched = today - timedelta(days=390 - (cycle_number - 1) * 14)
            db.add(models.ChemoCycle(
                regimen_id=reg3.regimen_id, cycle_number=cycle_number, scheduled_date=sched,
                administered_date=sched, status="ADMINISTERED", weight_kg=61.0, bsa_m2=1.6,
                toxicities=[{"ctcae_term": "Peripheral neuropathy", "grade": 1}] if cycle_number >= 4 else [],
            ))
        db.add(models.SurvivorshipPlan(
            patient_id=p3.patient_id, diagnosis_id=dx3.diagnosis_id,
            treatment_summary="Sigmoidectomy (R0 resection) followed by 6 cycles adjuvant FOLFOX, completed "
                              "with no residual disease on surveillance imaging.",
            surveillance_schedule=[
                {"test": "CEA blood test", "interval_months": 3},
                {"test": "CT chest/abdomen/pelvis", "interval_months": 6},
                {"test": "Colonoscopy", "interval_months": 12},
            ],
            late_effects_risks=["Chemotherapy-induced peripheral neuropathy", "Secondary malignancy risk"],
            next_followup_date=today + timedelta(days=45),
            lifestyle_recommendations="Maintain regular physical activity, balanced high-fiber diet, and "
                                       "avoid tobacco/alcohol. Routine colonoscopy surveillance per schedule.",
            created_by=None, status="ACTIVE",
        ))

        db.commit()
        print("Success: Seeded 3 demo oncology patients (Meera Krishnan, Rajesh Kumar, Anjali Verma).")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_oncology_demo()
