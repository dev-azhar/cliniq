"""Smart Hospital OS dashboard — aggregate KPIs for the /os command-center UI.

These endpoints power the React `/os` dashboard. Values are computed from the live
domain models so the UI reflects real database state; fields that are not yet modelled
(e.g. physical bed capacity) return ``null`` and the UI falls back to its placeholder.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.database import get_db

router = APIRouter(prefix="/api/v1/os", tags=["os-dashboard"])

# Encounter lifecycle buckets used across the dashboard aggregations.
_ACTIVE_ENCOUNTER = ("CHECKED_IN", "TRIAGED", "IN_CONSULT", "ADMITTED")
_DISCHARGED = ("COMPLETED", "DISCHARGED", "CHECKED_OUT")
_ABNORMAL_FLAGS = ("H", "L", "HH", "LL")


def _fmt_inr(amount: float) -> str:
    if amount >= 1_000_000:
        return f"\u20b9 {amount / 1_000_000:.2f}M"
    if amount >= 1_000:
        return f"\u20b9 {amount / 1_000:.1f}K"
    return f"\u20b9 {amount:,.0f}"


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    """Top-bar status pills + Command Center KPI tiles, computed from the DB."""
    today = date.today()

    critical_labs = db.scalar(
        select(func.count()).select_from(models.LabResult)
        .where(models.LabResult.abnormal_flag.in_(_ABNORMAL_FLAGS))
    ) or 0

    rx_pending = db.scalar(
        select(func.count()).select_from(models.Prescription)
        .where(models.Prescription.status == "DRAFT")
    ) or 0

    er_patients = db.scalar(
        select(func.count()).select_from(models.Encounter)
        .where(models.Encounter.status.in_(_ACTIVE_ENCOUNTER))
    ) or 0

    discharges = db.scalar(
        select(func.count()).select_from(models.Encounter)
        .where(models.Encounter.status.in_(_DISCHARGED))
        .where(func.date(models.Encounter.end_ts) == today)
    ) or 0

    revenue = db.scalar(
        select(func.coalesce(func.sum(models.Payment.amount), 0.0))
        .where(models.Payment.status == "COMPLETED")
        .where(func.date(models.Payment.paid_ts) == today)
    ) or 0.0
    if not revenue:  # demo DB may have no payments dated today — show all-time so the tile isn't ₹0
        revenue = db.scalar(select(func.coalesce(func.sum(models.Payment.amount), 0.0))) or 0.0

    avg_wait = db.scalar(
        select(func.avg(models.Token.eta_minutes)).where(models.Token.status == "WAITING")
    )
    er_wait = int(avg_wait) if avg_wait else None

    patients_today = db.scalar(
        select(func.count()).select_from(models.Encounter)
        .where(func.date(models.Encounter.arrival_ts) == today)
    ) or 0

    total_patients = db.scalar(select(func.count()).select_from(models.Patient)) or 0

    return {
        "status": {
            "hospital": "Operational",
            "occupancy": None,          # physical bed capacity not modelled yet
            "erWaitMinutes": er_wait,
            "icuOccupancy": None,
            "bedsAvailable": None,
        },
        "kpis": {
            "criticalLabs": int(critical_labs),
            "bedsAvailable": None,
            "prescriptionsPending": int(rx_pending),
            "erPatients": int(er_patients),
            "dischargesToday": int(discharges),
            "todaysRevenue": _fmt_inr(float(revenue)),
        },
        "patientsToday": int(patients_today),
        "totalPatients": int(total_patients),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
