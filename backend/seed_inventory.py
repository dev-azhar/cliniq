"""Seed the Inventory / Supply-chain domain (suppliers, stock items, purchase orders).

Idempotent: only seeds when the tables are empty. Run:  python -m seed_inventory
It is also invoked from app.seed so fresh deployments are populated automatically.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.database import SessionLocal, init_db

_TODAY = date.today()

_SUPPLIERS = [
    ("Medlink Pvt Ltd", 98.0, 4.6, 96.0, 5),
    ("HealthSupplies India", 95.0, 4.3, 94.0, 4),
    ("Surgitech Solutions", 92.0, 4.4, 91.0, 4),
    ("PharmaCare Pvt Ltd", 90.0, 4.1, 88.0, 4),
    ("Global Medicals", 89.0, 4.2, 87.0, 4),
]

# (code, name, category, unit, store, current, min, max, unit_cost, batch, expiry_days, consumed, non_moving)
_ITEMS = [
    ("MED-000123", "Paracetamol 650mg Tablet", "Pharmaceutical", "Tablet", "Pharmacy Store", 1250, 500, 2000, 1.2, "B240315", 210, 12450, False),
    ("MED-000124", "Amoxicillin 500mg Capsule", "Pharmaceutical", "Capsule", "Pharmacy Store", 640, 300, 1500, 3.5, "B240120", 160, 4200, False),
    ("MED-000131", "Ceftriaxone 1gm Injection", "Pharmaceutical", "Vial", "Pharmacy Store", 150, 100, 600, 42.0, "B240315", 23, 980, False),
    ("MED-000140", "Pantoprazole 40mg Injection", "Pharmaceutical", "Vial", "Pharmacy Store", 90, 120, 500, 28.0, "B240410", 30, 760, False),
    ("MED-000155", "Metronidazole 100ml IV", "Pharmaceutical", "Bottle", "Pharmacy Store", 120, 80, 400, 18.0, "B240310", 43, 640, False),
    ("MED-000160", "Meropenem 1gm Injection", "Pharmaceutical", "Vial", "ICU Store", 60, 40, 200, 220.0, "B240402", 46, 210, False),
    ("MED-000166", "Insulin Glargine 100IU", "Pharmaceutical", "Pen", "Pharmacy Store", 45, 30, 150, 310.0, "B240118", 12, 320, False),
    ("MED-000170", "Adrenaline 1mg Injection", "Pharmaceutical", "Ampoule", "ICU Store", 210, 100, 400, 14.0, "B240220", 95, 540, False),
    ("MED-000181", "Salbutamol Inhaler", "Pharmaceutical", "Unit", "Pharmacy Store", 88, 40, 200, 145.0, "B240105", 260, 190, False),
    ("MED-000190", "Heparin 5000IU Injection", "Pharmaceutical", "Vial", "ICU Store", 0, 50, 200, 36.0, "B231201", -20, 150, False),
    ("CON-000456", "Surgical Gloves (M)", "Medical Consumable", "Box", "Central Store", 85, 100, 500, 240.0, None, None, 7850, False),
    ("CON-000457", "Surgical Gloves (L)", "Medical Consumable", "Box", "Central Store", 320, 100, 500, 240.0, None, None, 5400, False),
    ("CON-000789", "IV Cannula 22G", "Medical Consumable", "Pcs", "Central Store", 0, 200, 1000, 12.0, None, None, 5910, False),
    ("CON-000790", "IV Cannula 20G", "Medical Consumable", "Pcs", "Central Store", 640, 200, 1000, 13.0, None, None, 4100, False),
    ("CON-000801", "IV Fluid NS 100ml", "Medical Consumable", "Bottle", "Central Store", 1820, 500, 3000, 22.0, "B240220", 120, 8320, False),
    ("CON-000802", "IV Fluid DNS 500ml", "Medical Consumable", "Bottle", "Central Store", 1240, 400, 2500, 28.0, "B240221", 140, 3600, False),
    ("SUR-000321", "Syringe 5ml", "Medical Consumable", "Pcs", "Central Store", 2860, 500, 5000, 3.2, None, None, 6240, False),
    ("SUR-000322", "Syringe 10ml", "Medical Consumable", "Pcs", "Central Store", 1980, 500, 5000, 3.8, None, None, 3100, False),
    ("CON-000811", "Face Mask 3-ply", "Medical Consumable", "Box", "Central Store", 540, 200, 1500, 85.0, None, None, 4300, False),
    ("CON-000815", "N95 Respirator", "Medical Consumable", "Box", "Central Store", 96, 100, 500, 320.0, None, None, 720, False),
    ("SUR-000401", "Suture Vicryl 3-0", "Surgical", "Pcs", "OT Store", 506, 100, 1000, 95.0, "B240210", 320, 1850, False),
    ("SUR-000402", "Suture Prolene 4-0", "Surgical", "Pcs", "OT Store", 78, 100, 800, 110.0, "B240115", 40, 640, False),
    ("SUR-000410", "Scalpel Blade No.11", "Surgical", "Box", "OT Store", 210, 50, 400, 45.0, None, None, 980, False),
    ("SUR-000420", "Bone Screw Titanium 6.5mm", "Surgical", "Pcs", "OT Store", 34, 40, 150, 1850.0, "B231115", 400, 96, False),
    ("SUR-000430", "Surgical Drape Sterile", "Surgical", "Pack", "OT Store", 420, 100, 800, 130.0, None, None, 1240, False),
    ("EQU-000654", "BP Monitor", "Equipment", "Pcs", "ICU Store", 12, 5, 20, 4200.0, None, None, 0, True),
    ("EQU-000655", "Pulse Oximeter", "Equipment", "Pcs", "ICU Store", 28, 10, 60, 1800.0, None, None, 0, True),
    ("EQU-000660", "Infusion Pump", "Equipment", "Pcs", "ICU Store", 18, 8, 40, 32000.0, None, None, 0, True),
    ("EQU-000670", "Nebulizer", "Equipment", "Pcs", "Central Store", 44, 15, 80, 2600.0, None, None, 0, False),
    ("EQU-000680", "Defibrillator", "Equipment", "Pcs", "ICU Store", 6, 3, 12, 145000.0, None, None, 0, True),
    ("OTH-000701", "Bed Sheet Disposable", "Other", "Pack", "Central Store", 880, 300, 2000, 40.0, None, None, 2100, False),
    ("OTH-000702", "Hand Sanitizer 500ml", "Other", "Bottle", "Central Store", 640, 200, 1500, 120.0, "B240301", 300, 1900, False),
    ("OTH-000710", "Cotton Roll 500g", "Other", "Roll", "Central Store", 132, 200, 800, 65.0, None, None, 90, True),
    ("MED-000200", "Diclofenac 50mg Tablet", "Pharmaceutical", "Tablet", "Pharmacy Store", 720, 300, 1500, 1.5, "B240210", 250, 2600, False),
    ("MED-000210", "Azithromycin 500mg Tablet", "Pharmaceutical", "Tablet", "Pharmacy Store", 410, 200, 1200, 8.0, "B240108", 18, 1400, False),
    ("CON-000820", "Urinary Catheter Foley", "Medical Consumable", "Pcs", "ICU Store", 260, 100, 600, 78.0, None, None, 540, False),
]

_PO = [
    ("PO-240520-001", "Medlink Pvt Ltd", 0, "Ordered", 245000.0),
    ("PO-240519-010", "HealthSupplies India", 1, "Approved", 112000.0),
    ("PO-240518-018", "Surgitech Solutions", 2, "Partially Received", 368000.0),
    ("PO-240518-015", "PharmaCare Pvt Ltd", 2, "Delivered", 98000.0),
    ("PO-240517-009", "Global Medicals", 3, "Ordered", 175000.0),
    ("PO-240516-004", "Medlink Pvt Ltd", 4, "Approved", 63000.0),
]


def seed_inventory(db: Session | None = None) -> None:
    own = db is None
    db = db or SessionLocal()
    try:
        if db.scalar(select(models.InventoryItem).limit(1)) is not None:
            return  # already seeded

        for name, otd, quality, fill, rating in _SUPPLIERS:
            db.add(models.Supplier(name=name, on_time_pct=otd, quality_score=quality, fill_rate=fill, rating=rating))

        for code, name, cat, unit, store, cur, mn, mx, cost, batch, exp_days, consumed, non_moving in _ITEMS:
            expiry = _TODAY + timedelta(days=exp_days) if exp_days is not None else None
            db.add(models.InventoryItem(
                code=code, name=name, category=cat, unit=unit, store=store,
                current_stock=cur, min_level=mn, max_level=mx, unit_cost=cost,
                batch_no=batch, expiry_date=expiry, consumed_month=consumed, non_moving=non_moving,
            ))

        for po_number, supplier, days_ago, status, value in _PO:
            db.add(models.PurchaseOrder(
                po_number=po_number, supplier=supplier,
                order_date=_TODAY - timedelta(days=days_ago), status=status, value=value,
            ))

        db.commit()
        print(f"Seeded {len(_SUPPLIERS)} suppliers, {len(_ITEMS)} inventory items, {len(_PO)} purchase orders.")
    finally:
        if own:
            db.close()


if __name__ == "__main__":
    init_db()
    seed_inventory()
