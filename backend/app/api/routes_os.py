"""Smart Hospital OS dashboard — aggregate KPIs for the /os command-center UI.

These endpoints power the React `/os` dashboard. Values are computed from the live
domain models so the UI reflects real database state; fields that are not yet modelled
(e.g. physical bed capacity) return ``null`` and the UI falls back to its placeholder.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.database import get_db
from app.core.os_auth import require_os_staff, sign_os_token

router = APIRouter(prefix="/api/v1/os", tags=["os-dashboard"])

# Shared demo credential for the /os console. Any staff member can sign in with
# their own access PIN, or with this password when PINs are not seeded.
OS_DEMO_PASSWORD = "cliniq"

# UI role tabs (LoginOS) → Staff.role values stored in the DB.
_ROLE_MAP = {"doctor": "DOCTOR", "nurse": "NURSE", "admin": "OPS", "pharmacist": "PHARMACIST"}
_ROLE_LABELS = {"DOCTOR": "Doctor", "NURSE": "Nurse", "OPS": "Administration", "PHARMACIST": "Pharmacist"}


class OsLoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    role: str = "Doctor"


@router.post("/login")
def os_login(body: OsLoginRequest, db: Session = Depends(get_db)) -> dict:
    """Authenticate a staff member for the /os console.

    Resolves the typed username against the Staff directory (by name or id) and
    accepts either that member's ``access_pin`` or the shared demo password.
    """
    username = body.username.strip()
    password = body.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    staff = db.scalars(select(models.Staff)).all()
    match = next(
        (s for s in staff if s.name.lower() == username.lower() or s.staff_id == username),
        None,
    )

    pin_ok = bool(match and match.access_pin and password == match.access_pin)
    demo_ok = password == OS_DEMO_PASSWORD
    if not (pin_ok or demo_ok):
        raise HTTPException(status_code=401, detail="Invalid credentials. Check your username and password.")

    if match:
        role = match.role
        name = match.name
        department = match.department
        specialty = match.specialty
        staff_id = match.staff_id
    else:
        # Demo sign-in for a name not in the directory: honour the selected role tab.
        role = _ROLE_MAP.get(body.role.strip().lower(), "DOCTOR")
        name = username
        department = None
        specialty = None
        staff_id = None

    profile = {
        "staffId": staff_id,
        "name": name,
        "role": role,
        "roleLabel": _ROLE_LABELS.get(role, body.role.strip().title() or "Staff"),
        "department": department or specialty or "General",
        "specialty": specialty,
    }
    token, expires_at = sign_os_token({"sub": staff_id or name, **profile})
    return {
        **profile,
        "token": token,
        "expiresAt": expires_at,
        "authenticatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/me")
def me(claims: dict = Depends(require_os_staff)) -> dict:
    """Validate the caller's token and echo back their session profile."""
    return {
        "staffId": claims.get("staffId"),
        "name": claims.get("name"),
        "role": claims.get("role"),
        "roleLabel": claims.get("roleLabel"),
        "department": claims.get("department"),
        "specialty": claims.get("specialty"),
        "expiresAt": claims.get("exp"),
    }



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


def _fmt_inr_indian(amount: float) -> str:
    """Indian short currency: crore / lakh / thousand."""
    if amount >= 10_000_000:
        return f"\u20b9 {amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"\u20b9 {amount / 100_000:.2f} L"
    if amount >= 1_000:
        return f"\u20b9 {amount / 1_000:.1f} K"
    return f"\u20b9 {amount:,.0f}"



@router.get("/overview")
def overview(db: Session = Depends(get_db), _claims: dict = Depends(require_os_staff)) -> dict:
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


_CLAIM_APPROVED = ("APPROVED", "PAID", "SETTLED")
_CLAIM_DENIED = ("DENIED", "REJECTED")
_PAYMENT_METHODS = ("UPI", "CARD", "CASH", "WALLET", "NETBANKING")
_METHOD_LABELS = {"UPI": "UPI", "CARD": "Card", "CASH": "Cash", "WALLET": "Wallet", "NETBANKING": "Net Banking"}


def _invoice_display_status(total: float, balance: float, created: datetime | None) -> str:
    if balance <= 0:
        return "Paid"
    if 0 < balance < total:
        return "Partially Paid"
    created = created.replace(tzinfo=timezone.utc) if created and created.tzinfo is None else created
    if created and (datetime.now(timezone.utc) - created).days > 30:
        return "Overdue"
    return "Unpaid"


@router.get("/billing")
def billing(db: Session = Depends(get_db), _claims: dict = Depends(require_os_staff)) -> dict:
    """Billing Command Center — KPIs, AR aging, claims, payment modes, worklist."""
    invoices = db.scalars(select(models.Invoice)).all()
    claims = db.scalars(select(models.InsuranceClaim)).all()
    payments = db.scalars(
        select(models.Payment).where(models.Payment.status == "COMPLETED")
    ).all()

    # KPIs
    claims_approved = sum(1 for c in claims if (c.status or "").upper() in _CLAIM_APPROVED)
    claims_denied = sum(1 for c in claims if (c.status or "").upper() in _CLAIM_DENIED)
    claims_pending = len(claims) - claims_approved - claims_denied
    refunds = sum(1 for p in db.scalars(select(models.Payment).where(models.Payment.status == "REFUNDED")))

    # AR aging by invoice balance and age
    now = datetime.now(timezone.utc)
    ar_buckets = {"0 – 30 Days": 0.0, "31 – 60 Days": 0.0, "61 – 90 Days": 0.0, "91 – 120 Days": 0.0, "120+ Days": 0.0}
    for inv in invoices:
        bal = inv.balance or 0.0
        if bal <= 0:
            continue
        created = inv.created_ts
        created = created.replace(tzinfo=timezone.utc) if created and created.tzinfo is None else created
        days = (now - created).days if created else 0
        key = "0 – 30 Days" if days <= 30 else "31 – 60 Days" if days <= 60 else "61 – 90 Days" if days <= 90 else "91 – 120 Days" if days <= 120 else "120+ Days"
        ar_buckets[key] += bal
    total_ar = sum(ar_buckets.values())

    # Payment mode split
    mode_totals: dict[str, float] = {}
    for p in payments:
        method = (p.method or "OTHER").upper()
        mode_totals[method] = mode_totals.get(method, 0.0) + (p.amount or 0.0)
    total_collected = sum(mode_totals.values())
    payment_modes = [
        {"label": _METHOD_LABELS.get(m, m.title()), "value": _fmt_inr_indian(v),
         "pct": round(v / total_collected * 100, 1) if total_collected else 0.0}
        for m, v in sorted(mode_totals.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # Invoice worklist (recent) joined to patient
    patients = {p.patient_id: p for p in db.scalars(select(models.Patient))}
    encounters = {e.encounter_id: e for e in db.scalars(select(models.Encounter))}
    recent_invoices = sorted(invoices, key=lambda i: i.created_ts or now, reverse=True)[:8]
    worklist = []
    for inv in recent_invoices:
        pt = patients.get(inv.patient_id)
        enc = encounters.get(inv.encounter_id)
        visit = (enc.visit_type if enc else None) or "OPD"
        worklist.append({
            "invoice": f"INV-{inv.invoice_id[:8].upper()}",
            "name": pt.full_name if pt else "—",
            "mrn": (pt.mrn if pt else None) or "—",
            "date": (inv.created_ts or now).strftime("%b %d, %Y"),
            "visit": {"OPD": "Outpatient", "FOLLOWUP": "Follow-up"}.get(visit, visit.title()),
            "gross": _fmt_inr_indian(inv.total or 0.0),
            "balance": _fmt_inr_indian(inv.balance or 0.0),
            "status": _invoice_display_status(inv.total or 0.0, inv.balance or 0.0, inv.created_ts),
        })

    # Recent payments joined to patient via invoice
    inv_by_id = {i.invoice_id: i for i in invoices}
    recent_payments = sorted(payments, key=lambda p: p.paid_ts or now, reverse=True)[:6]
    payment_rows = []
    for p in recent_payments:
        inv = inv_by_id.get(p.invoice_id)
        pt = patients.get(inv.patient_id) if inv else None
        payment_rows.append({
            "receipt": f"RCPT-{p.payment_id[:7].upper()}",
            "name": pt.full_name if pt else "—",
            "method": _METHOD_LABELS.get((p.method or "").upper(), (p.method or "—").title()),
            "amount": _fmt_inr_indian(p.amount or 0.0),
            "on": (p.paid_ts or now).strftime("%b %d, %Y"),
        })

    return {
        "kpis": {
            "totalInvoices": len(invoices),
            "claimsSubmitted": len(claims),
            "claimsPaid": claims_approved,
            "denials": claims_denied,
            "paymentPosts": len(payments),
            "refunds": refunds,
        },
        "arAging": {
            "total": _fmt_inr_indian(total_ar),
            "segments": [
                {"label": k, "value": _fmt_inr_indian(v),
                 "pct": round(v / total_ar * 100, 1) if total_ar else 0.0}
                for k, v in ar_buckets.items()
            ],
        },
        "claimsSummary": {
            "total": len(claims),
            "approved": claims_approved,
            "denied": claims_denied,
            "pending": max(0, claims_pending),
        },
        "paymentModes": {"total": _fmt_inr_indian(total_collected), "modes": payment_modes},
        "invoices": worklist,
        "recentPayments": payment_rows,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def _item_status(it: "models.InventoryItem", today: date) -> str:
    if it.current_stock == 0:
        return "Out of Stock"
    if it.expiry_date and it.expiry_date < today:
        return "Expired"
    if it.current_stock < it.min_level:
        return "Low Stock"
    if it.non_moving:
        return "Non-moving"
    return "In Stock"


@router.get("/inventory")
def inventory(db: Session = Depends(get_db), _claims: dict = Depends(require_os_staff)) -> dict:
    """Inventory Command Center — stock overview, valuation, worklist, POs, suppliers."""
    today = date.today()
    items = db.scalars(select(models.InventoryItem)).all()
    pos = db.scalars(select(models.PurchaseOrder)).all()
    suppliers = db.scalars(select(models.Supplier)).all()

    total_value = sum((it.current_stock or 0) * (it.unit_cost or 0.0) for it in items)
    statuses = [_item_status(it, today) for it in items]
    status_counts = {s: statuses.count(s) for s in ("In Stock", "Low Stock", "Out of Stock", "Non-moving", "Expired")}
    expiring_soon = [it for it in items if it.expiry_date and today <= it.expiry_date <= today + timedelta(days=30)]

    total = len(items) or 1
    overview_palette = {
        "In Stock": "#16a34a", "Low Stock": "#CA5010", "Out of Stock": "#D13438",
        "Non-moving": "#94a3b8", "Expired": "#8764B8",
    }
    stock_overview = [
        {"label": s, "value": f"{c:,} ({c / total * 100:.1f}%)", "pct": round(c / total * 100, 1), "color": overview_palette[s]}
        for s, c in status_counts.items()
    ]

    # Value by category
    cat_palette = {"Pharmaceutical": "#0078d4", "Medical Consumable": "#16a34a", "Surgical": "#CA8A04", "Equipment": "#8764B8", "Other": "#94a3b8"}
    cat_totals: dict[str, float] = {}
    for it in items:
        cat_totals[it.category] = cat_totals.get(it.category, 0.0) + (it.current_stock or 0) * (it.unit_cost or 0.0)
    value_by_category = [
        {"label": c, "value": _fmt_inr_indian(v), "pct": round(v / total_value * 100, 1) if total_value else 0.0,
         "color": cat_palette.get(c, "#94a3b8")}
        for c, v in sorted(cat_totals.items(), key=lambda kv: kv[1], reverse=True)
    ]

    status_tone = {"In Stock": "#16a34a", "Low Stock": "#CA5010", "Out of Stock": "#D13438", "Non-moving": "#94a3b8", "Expired": "#8764B8"}
    worklist = [{
        "code": it.code, "name": it.name, "category": it.category, "unit": it.unit,
        "current": f"{it.current_stock:,}", "min": f"{it.min_level:,}", "max": f"{it.max_level:,}",
        "status": st, "updated": it.updated_ts.strftime("%b %d, %Y") if it.updated_ts else "—",
    } for it, st in sorted(zip(items, statuses), key=lambda z: z[0].code)[:8]]

    tab_counts = {
        "allItems": len(items),
        "lowStock": status_counts["Low Stock"],
        "outOfStock": status_counts["Out of Stock"],
        "expiringSoon": len(expiring_soon),
        "nonMoving": status_counts["Non-moving"],
    }

    recent_pos = [{
        "po": p.po_number, "supplier": p.supplier, "date": p.order_date.strftime("%b %d, %Y") if p.order_date else "—",
        "status": p.status, "value": _fmt_inr_indian(p.value or 0.0),
    } for p in sorted(pos, key=lambda p: p.order_date or today, reverse=True)]

    expiring = [{
        "name": it.name, "batch": it.batch_no or "—",
        "exp": it.expiry_date.strftime("%b %d, %Y"), "qty": f"{it.current_stock:,}",
    } for it in sorted(expiring_soon, key=lambda it: it.expiry_date)][:6]

    top_consumed = [{
        "name": it.name, "qty": f"{it.consumed_month:,}", "unit": it.unit,
    } for it in sorted(items, key=lambda it: it.consumed_month or 0, reverse=True)[:5]]

    store_names: list[str] = []
    for it in items:
        if it.store not in store_names:
            store_names.append(it.store)
    stores = []
    for name in store_names:
        group = [(it, st) for it, st in zip(items, statuses) if it.store == name]
        stores.append({
            "store": name,
            "total": f"{len(group):,}",
            "inStock": f"{sum(1 for _, st in group if st == 'In Stock'):,}",
            "low": f"{sum(1 for _, st in group if st == 'Low Stock'):,}",
            "out": f"{sum(1 for _, st in group if st == 'Out of Stock'):,}",
            "value": _fmt_inr_indian(sum((it.current_stock or 0) * (it.unit_cost or 0.0) for it, _ in group)),
        })

    supplier_rows = [{
        "name": s.name, "otd": f"{s.on_time_pct:.0f}%", "quality": f"{s.quality_score:.1f}",
        "fill": f"{s.fill_rate:.0f}%", "rating": int(s.rating),
    } for s in sorted(suppliers, key=lambda s: s.rating, reverse=True)][:5]

    grn_pending = sum(1 for p in pos if p.status in ("Ordered", "Approved"))
    in_transit = sum(1 for p in pos if p.status == "Partially Received")

    return {
        "kpis": {
            "totalItems": len(items),
            "stockValue": _fmt_inr_indian(total_value),
            "purchaseOrders": len(pos),
            "grnPending": grn_pending,
            "transfersInTransit": in_transit,
            "suppliers": len(suppliers),
        },
        "stockOverview": {"total": f"{len(items):,}", "segments": stock_overview},
        "valueByCategory": {"total": _fmt_inr_indian(total_value), "segments": value_by_category},
        "tabCounts": tab_counts,
        "items": worklist,
        "purchaseOrders": recent_pos,
        "expiring": expiring,
        "topConsumed": top_consumed,
        "stores": stores,
        "suppliers": supplier_rows,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


