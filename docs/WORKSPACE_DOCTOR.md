# ClinIQ — Doctor Workspace

> **Audience:** Doctor portal developer
> Read `SYSTEM_FLOW_OVERVIEW.md` first for the big picture.

---

## Overview

The Doctor Workspace is a **clinical-only interface**. The doctor never handles payment.
All payment info is read-only. The doctor's job is: review → diagnose → prescribe → discharge.

AI tools (Summary, CDS) assist the doctor but **every action requires doctor approval**.

---

## 1. Doctor Home — Patient Queue

When the doctor logs in, they see their queue for the day:

```
┌──────────────────────────────────────────────────────────────────┐
│  Dr. Ananya Mehta — General Medicine — Room 101, Floor 1         │
│  Today: 13 July 2026 | 8 patients                               │
├──────┬──────────────┬─────┬───────────┬──────────────┬──────────┤
│ Token│ Patient Name │ Age │ Slot      │ Status       │ Action   │
├──────┼──────────────┼─────┼───────────┼──────────────┼──────────┤
│ A-061│ Ramesh Kumar │ 52M │ 10:00 AM  │ ✅ Discharged│ View     │
│ A-062│ Priya Singh  │ 34F │ 10:15 AM  │ 🔄 With You  │ Active   │
│ A-063│ Vikram Nair  │ 45M │ 10:30 AM  │ ⏳ Triage Done│ [Call In]│
│ A-064│ Sneha Reddy  │ 28F │ 11:00 AM  │ ⏳ Triage Done│ [Call In]│
│ A-065│ Arjun Pillai │ 67M │ 11:15 AM  │ 🩺 At Triage │ —        │
└──────┴──────────────┴─────┴───────────┴──────────────┴──────────┘
```

- Doctor clicks **[Call In]** to open a patient's workspace
- Only one patient is "Active / With Doctor" at a time
- Discharged patients can be viewed (read-only)

---

## 2. Patient Workspace — Tabs

When doctor opens a patient's record, they see **5 tabs**:

```
[ Patient 360 ] [ Ambient SOAP ] [ Orders & Labs ] [ Prescription ] [ Billing & Discharge ]
```

---

## 3. Tab 1 — Patient 360

**Purpose:** Give doctor the full clinical picture instantly before talking to the patient.

**Shows:**
- Name, Age, Gender, ABHA ID
- Chief complaint (entered by nurse at triage)
- Vitals from today's triage: BP, Temp, HR, SpO2, Weight
- ⚠️ Any flagged critical vitals highlighted in red/yellow
- Known allergies & alerts
- Active medications (from previous visits)
- Past visit history — list of previous consultations with dates, diagnoses
- Previous lab reports (viewable)
- Previous prescriptions (viewable)

**Button:** `[Generate AI Summary]`
- AI reads all records, past visits, current vitals and generates a structured clinical summary
- Output: Chief complaint → Relevant history → Current vitals → Key concerns → Suggested differential (advisory only)
- Doctor reviews, can edit or dismiss
- This is advisory — doctor is not bound by it

---

## 4. Tab 2 — Ambient SOAP Notes

**Purpose:** Doctor writes the clinical encounter notes.

**Structure:**
```
S — Subjective:  [What patient says / chief complaint in doctor's words]
O — Objective:   [Exam findings, vitals — auto-filled from triage, editable]
A — Assessment:  [Diagnosis — doctor types, ICD-10 code auto-suggested]
P — Plan:        [Treatment plan, advice, follow-up]
```

**Features:**
- Free-text fields for each section
- ICD-10 code auto-suggest as doctor types diagnosis
- Notes auto-saved as draft — not final until doctor discharges

---

## 5. Tab 3 — Orders & Labs

**Purpose:** Doctor orders lab tests when needed. Used only when lab tests are required.

**Flow:**
```
Doctor searches test name (e.g. "CBC", "LFT", "X-Ray Chest PA")
      │
      Select tests → Add to order list
      │
      Review order list:
        • CBC — ₹250
        • LFT — ₹350
        • X-Ray Chest PA — ₹500
        Total: ₹1,100
      │
      [Confirm Orders]
              │
      ✅ Orders saved
      ✅ When doctor discharges, patient notified to book lab slot + pay
      ✅ Lab portal receives order when patient payment confirmed
```

**Important:**
- Doctor places orders first, then discharges
- Doctor does NOT collect lab payment — patient does it via app or reception
- No prescription is given at this visit if labs are required (usually)
- Doctor writes prescription AFTER reviewing lab reports (via e-consult or revisit)

---

## 6. Tab 4 — Prescription

**Purpose:** Doctor writes the final medicine prescription.

**Fields per medicine:**
```
Medicine Name: [searchable — generic + brand names]
Dosage:        [e.g. 500mg]
Frequency:     [Once/Twice/Thrice daily / SOS]
Duration:      [e.g. 5 days]
Instructions:  [e.g. After food / Before food / With water]
```

**Add multiple medicines. Remove any line.**

**Button:** `[Run CDS Check]`
- After entering all medicines, doctor clicks this
- AI checks:
  - Drug-drug interactions
  - Drug-allergy conflicts (cross-checks patient's known allergies)
  - Dose appropriateness for age/weight
  - Relevance to diagnosed condition
- Output shown as:
  - ✅ Green — No issues
  - 🟡 Yellow — Advisory warning (doctor can proceed)
  - 🔴 Red — Serious interaction (doctor should review)
- Doctor reviews CDS output and decides — CDS is advisory, not blocking

---

## 7. Tab 5 — Billing & Discharge

**Purpose:** Doctor reviews payment (READ-ONLY) and closes the visit.

**What this tab shows:**
```
┌────────────────────────────────────────┐
│ Invoice Summary                        │
│                                        │
│ OPD Consultation Fee    ₹500           │
│ Balance                 ₹0             │
│                                        │
│ ✅ PAID                                │
│ Method: UPI                            │
│ Time: 10:32 AM, 13 July 2026           │
│ Receipt No: RCP-2026-064               │
└────────────────────────────────────────┘
```

**No payment buttons. No UPI option. Just the above — read-only.**

**Discharge Button:**

```
Scenario A — No lab tests ordered:
[Discharge Patient]
      │
      ✅ Visit closed
      ✅ SOAP notes locked (read-only)
      ✅ Prescription finalized
      ✅ Patient record auto-created in patient app with:
            - Doctor's SOAP notes
            - Diagnosis + ICD codes
            - Final prescription PDF
      ✅ Patient push notification sent
      ✅ ABDM PHR updated (background)
      ✅ Token marked as Discharged in queue

Scenario B — Lab tests ordered:
[Discharge Patient] (no prescription yet)
      │
      ✅ Visit partially closed
      ✅ SOAP notes locked
      ✅ Lab orders finalized
      ✅ Patient notified to book lab slot + pay
      ✅ Token marked as Discharged (pending labs)
```

---

## 8. E-Consult — Doctor Side (After Lab Reports)

When patient sends lab reports for e-consult:

```
Doctor receives notification:
"Sneha Reddy's lab reports are ready for e-consult review"
      │
Doctor opens E-Consult view:
  ├── See uploaded lab reports (images/PDF from technician)
  ├── Compare values against normal ranges (auto-highlighted)
  ├── [Generate AI Summary] — AI summarizes report findings
  ├── Write Prescription (same prescription tab)
  ├── Run CDS check
  └── [Complete E-Consult]
          │
          ✅ Prescription sent to patient app
          ✅ Full visit record updated (original notes + labs + Rx)
          ✅ E-consult marked as done (patient cannot repeat for same episode)
```

**E-consult is FREE for the patient — once per lab episode.**

---

## 9. What the Doctor Should NEVER See

- Payment buttons (Pay via UPI, Cashless claim, etc.)
- Patient's payment card details
- Anything related to billing operations
- Lab slot booking UI (that's patient's job)
- Pharmacy dispensing status (not doctor's concern)

---

## 📌 Notes for Developer

- **Discharge is the critical action** — it triggers a cascade: record creation, patient notification, ABDM push, queue update. Make sure these are atomic or at minimum all queued.
- **SOAP notes are auto-saved as draft** during the session. Only locked on discharge.
- **CDS is non-blocking** — doctor can always proceed even with red flags (but red flags must be visible).
- **AI Summary is on-demand** — only runs when doctor clicks the button. Not automatic.
- **ICD-10 codes** should be suggested as doctor types in the Assessment field.
- **One patient active at a time** — doctor cannot open two patients simultaneously.
- **Returning patients** — Patient 360 must show history from all previous visits, not just today's.
