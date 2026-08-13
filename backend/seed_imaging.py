"""Seed a few imaging studies (as SCAN Documents) for demo patients.

Idempotent: only seeds when no imaging documents exist yet. Run: python -m seed_imaging
Also invoked from app.seed so fresh deployments have imaging in the Patient 360.
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.database import SessionLocal, init_db
from app.models import _utcnow

_IMAGING_TYPES = ("SCAN", "IMAGING", "RADIOLOGY", "XRAY", "CT", "MRI", "ULTRASOUND")

# mrn -> [(title, days_ago), ...]
_STUDIES = {
    "MRN-E2E-006": [("Chest X-Ray PA View", 2), ("Echocardiogram (2D)", 1), ("CT Coronary Angiography", 0)],
    "MRN-E2E-007": [("CT Chest w/ Contrast", 1), ("Chest X-Ray AP View", 3)],
    "MRN-E2E-009": [("Chest X-Ray PA View", 0), ("USG Abdomen & Pelvis", 2)],
    "MRN-E2E-008": [("MRI Brain (Plain)", 1)],
    "MRN-E2E-001": [("X-Ray Left Knee", 2), ("MRI Left Knee", 0)],
    "MRN-E2E-002": [("USG Whole Abdomen", 1)],
}


def seed_imaging(db: Session | None = None) -> None:
    own = db is None
    db = db or SessionLocal()
    try:
        existing = db.scalar(
            select(models.Document).where(models.Document.doc_type.in_(_IMAGING_TYPES)).limit(1)
        )
        if existing is not None:
            return  # already seeded

        added = 0
        for mrn, studies in _STUDIES.items():
            patient = db.scalar(select(models.Patient).where(models.Patient.mrn == mrn))
            if patient is None:
                continue
            for title, days_ago in studies:
                db.add(models.Document(
                    patient_id=patient.patient_id,
                    doc_type="SCAN",
                    title=title,
                    uri=None,
                    created_ts=_utcnow() - timedelta(days=days_ago),
                ))
                added += 1
        db.commit()
        print(f"Seeded {added} imaging studies across demo patients.")
    finally:
        if own:
            db.close()


if __name__ == "__main__":
    init_db()
    seed_imaging()
