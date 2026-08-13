# ClinIQ — Pharmacy Module

> **Audience:** Pharmacy module developer
> Read `SYSTEM_FLOW_OVERVIEW.md` first for the big picture.

---

## Overview

The Pharmacy Module is used by the **hospital pharmacist** to:
1. Look up a patient's prescription using their mobile number
2. See the exact medicines, dosage, and instructions prescribed by the doctor
3. Dispense medicines and mark as fulfilled

The pharmacy module is **optional for the patient** — they may buy medicines from outside too.
Pharmacist does NOT prescribe or modify medicines.

---

## 1. Pharmacist Home Screen

Simple lookup interface:

```
┌──────────────────────────────────────┐
│  Pharmacy — ClinIQ                 │
│                                      │
│  Patient Lookup                      │
│  Enter Mobile Number:                │
│  [ 9876543210    ]  [Search]         │
│                                      │
│  OR scan patient QR code from app    │
│  [📷 Scan QR]                        │
└──────────────────────────────────────┘
```

---

## 2. Patient Lookup & Prescription View

When pharmacist enters mobile number and searches:

```
Patient Found: Sneha Reddy
Visit: 13 July 2026 — Dr. Ananya Mehta (General Medicine)
Diagnosis: Pharyngitis

Prescription:
┌───────────────────┬────────┬───────────────────┬──────────┬──────────────────┐
│ Medicine          │ Dosage │ Frequency         │ Duration │ Instructions     │
├───────────────────┼────────┼───────────────────┼──────────┼──────────────────┤
│ Azithromycin      │ 500mg  │ Once daily        │ 5 days   │ After food       │
│ Paracetamol       │ 650mg  │ SOS (as needed)   │ 3 days   │ With water       │
│ Betadine Gargle   │ —      │ Twice daily       │ 5 days   │ Dilute in water  │
└───────────────────┴────────┴───────────────────┴──────────┴──────────────────┘

Doctor's Note: "Patient has mild pharyngitis. Advise rest and warm fluids."

Prescription Status: 🟡 Not yet dispensed

[Mark as Dispensed]
```

---

## 3. Dispense Flow

```
Pharmacist reviews prescription
      │
      Collects medicines from stock
      │
      [Mark as Dispensed]
              │
      Confirmation popup:
      "Mark all medicines as dispensed for Sneha Reddy?"
      [Confirm] [Cancel]
              │
      ✅ Prescription marked as Dispensed
      ✅ Timestamp recorded
      ✅ Patient app record updated:
            "Prescription dispensed at ClinIQ Pharmacy — 13 July 2026, 3:15 PM"
```

---

## 4. What Pharmacist Sees (Read-Only)

| Field | Visible to Pharmacist |
|---|---|
| Patient name, age, gender | ✅ Yes |
| Diagnosis | ✅ Yes |
| Doctor's prescription | ✅ Yes |
| Doctor's clinical notes (brief) | ✅ Yes |
| Previous prescriptions | ❌ No — only current visit |
| Lab reports | ❌ No |
| Payment info | ❌ No |
| Patient address, Aadhaar | ❌ No |

**Pharmacist has minimum necessary access only.**

---

## 5. Multiple Active Prescriptions

If a patient has multiple recent prescriptions (e.g., from two different visits):

```
Patient: Sneha Reddy — 9876543210

Recent Prescriptions:
  ● 13 July 2026 — Dr. Mehta (General Med)   [🟡 Not Dispensed] [View]
  ● 05 July 2026 — Dr. Sharma (ENT)           [✅ Dispensed]      [View]
```

Pharmacist selects the relevant one.

---

## 6. Patient Comes Without Digital Prescription

If patient comes to pharmacy without their phone or no app access:
- Pharmacist searches by mobile number — prescription appears
- Pharmacist can also search by **Token Number** (printed on their receipt/confirmation)

---

## 📌 Notes for Developer

- **Mobile number is the key** — primary lookup. Also support QR code scan from patient app (QR encodes mobile + visit ID).
- **Read-only** — pharmacist cannot edit the prescription in any way.
- **One active prescription at a time is highlighted** — most recent undispensed prescription shown first.
- **After dispensing** — patient app record shows a "Dispensed" badge on that visit's prescription.
- **Prescription visibility** — only show prescriptions from completed/discharged visits. In-progress consultations are not visible.
- **No stock management in MVP** — pharmacist just marks as dispensed. Inventory management is a future feature.
