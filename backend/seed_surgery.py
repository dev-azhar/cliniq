"""Seed the Surgery / OT domain (today's operating-room schedule).

Idempotent: only seeds when the table is empty. Run:  python -m seed_surgery
Also invoked from app.seed so fresh deployments are populated automatically.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.database import SessionLocal, init_db


def _today_at(hour: int, minute: int) -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


# (or, patient, mrn, procedure, surgeon, surgeon_role, anesthetist, anesthesia, status, priority, start(h,m), duration, progress)
_SURGERIES = [
    ("OR 1", "Ahmed Khan", "CLN-00011223", "Laparoscopic Cholecystectomy", "Dr. Ahmed Ali", "Chief Surgeon", "Dr. Sara Khan", "General", "In Progress", "High", (8, 0), 90, 80),
    ("OR 2", "Sara Ali", "CLN-00067890", "Total Knee Replacement", "Dr. Rehan Malik", "Orthopedic", "Dr. Imran Shah", "Spinal", "In Progress", "High", (9, 45), 120, 65),
    ("OR 3", "Bilal Ahmed", "CLN-00011224", "Robotic Prostatectomy", "Dr. Ahmed Ali", "Chief Surgeon", "Dr. Ayesha Noor", "General", "In Pre-Op", "High", (11, 30), 150, 40),
    ("OR 4", "Maryam Khan", "CLN-00033445", "Hysterectomy", "Dr. Saba Fatima", "Gynecologist", "Dr. Sara Khan", "General", "Scheduled", "Routine", (13, 30), 90, 0),
    ("OR 5", "Usman Tariq", "CLN-00055678", "Shoulder Arthroscopy", "Dr. Rehan Malik", "Orthopedic", "Dr. Imran Shah", "Regional", "Scheduled", "Routine", (15, 15), 60, 0),
    ("OR 1", "Fatima Sheikh", "CLN-00088123", "Appendectomy", "Dr. Ahmed Ali", "Chief Surgeon", "Dr. Sara Khan", "General", "Post-Op", "Emergency", (6, 30), 60, 100),
    ("OR 2", "Imran Qureshi", "CLN-00090456", "Inguinal Hernia Repair", "Dr. Faisal Rana", "General Surgeon", "Dr. Ayesha Noor", "Spinal", "Completed", "Routine", (7, 0), 75, 100),
    ("OR 3", "Ayesha Malik", "CLN-00077321", "Cataract Surgery", "Dr. Nadia Aslam", "Ophthalmologist", "Dr. Imran Shah", "Local", "Completed", "Routine", (7, 30), 40, 100),
    ("OR 4", "Zain Abbas", "CLN-00066998", "Tonsillectomy", "Dr. Kamran Ali", "ENT Surgeon", "Dr. Sara Khan", "General", "Cancelled", "Routine", (10, 0), 45, 0),
    ("OR 5", "Hina Raza", "CLN-00055443", "Laparoscopic Appendectomy", "Dr. Faisal Rana", "General Surgeon", "Dr. Ayesha Noor", "General", "Post-Op", "High", (9, 0), 70, 100),
]


def seed_surgery(db: Session | None = None) -> None:
    own = db is None
    db = db or SessionLocal()
    try:
        if db.scalar(select(models.Surgery).limit(1)) is not None:
            return  # already seeded

        for orr, patient, mrn, proc, surgeon, srole, anes, anes_type, status, priority, (h, m), dur, progress in _SURGERIES:
            db.add(models.Surgery(
                or_room=orr, patient_name=patient, mrn=mrn, procedure=proc,
                surgeon=surgeon, surgeon_role=srole, anesthetist=anes, anesthesia_type=anes_type,
                status=status, priority=priority, scheduled_start=_today_at(h, m),
                duration_min=dur, progress_pct=progress,
            ))
        db.commit()
        print(f"Seeded {len(_SURGERIES)} surgeries for today's OT board.")
    finally:
        if own:
            db.close()


if __name__ == "__main__":
    init_db()
    seed_surgery()
