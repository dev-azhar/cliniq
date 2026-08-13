# ClinIQ — Lab Technician Portal

> **Audience:** Lab portal developer
> Read `SYSTEM_FLOW_OVERVIEW.md` first for the big picture.

---

## Overview

The Lab Portal is used by the **lab technician** to:
1. See which patients have booked lab slots and confirmed payment
2. Mark sample collected
3. Upload test results (PDF / images)

The lab technician does NOT place orders — that is done by the doctor.
The lab technician does NOT collect payment — that is done by the patient (app or reception).

---

## 1. Lab Technician Dashboard — Today's Slots

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Lab Portal — 13 July 2026                                               │
├──────────┬──────────────┬──────────────────┬──────────────┬─────────────┤
│ Slot Time│ Patient Name │ Tests Ordered    │ Payment      │ Status      │
├──────────┼──────────────┼──────────────────┼──────────────┼─────────────┤
│ 10:00 AM │ Sneha Reddy  │ CBC, LFT         │ ✅ Paid ₹600 │ [Start]     │
│ 10:30 AM │ Ramesh Kumar │ Blood Sugar, ECG │ ✅ Paid ₹400 │ [Start]     │
│ 11:00 AM │ Priya Singh  │ X-Ray Chest PA   │ ✅ Paid ₹500 │ [Start]     │
│ 11:30 AM │ Vikram Nair  │ CBC              │ ⏳ Pending   │ [Waiting]   │
└──────────┴──────────────┴──────────────────┴──────────────┴─────────────┘
```

**Rules:**
- Only show slots where **payment is confirmed** (Paid ✅)
- Pending payment slots are visible but not actionable — technician cannot start
- Slots are ordered by time

---

## 2. Patient Detail View

When technician clicks [Start] on a patient:

```
Patient: Sneha Reddy
Mobile: 9876543210
Doctor: Dr. Ananya Mehta — General Medicine
Ordered by visit: 13 July 2026, 10:32 AM

Tests to perform:
  ☐ CBC (Complete Blood Count)
  ☐ LFT (Liver Function Test)

Payment: ✅ ₹600 paid via UPI at 11:45 AM
Slot: 2:00 PM — 13 July 2026

[Mark Sample Collected]
```

---

## 3. Workflow Step by Step

```
Step 1: Patient arrives at lab at their booked slot time
      │
      Lab technician finds patient in today's list
      Confirms identity: name + mobile number
      │
Step 2: [Mark Sample Collected]
      │
      Status updates to "Sample Collected"
      Patient app shows: "Sample collected, results coming soon"
      │
Step 3: Technician runs the tests
      (this happens offline — no system action needed during testing)
      │
Step 4: Results are ready → Technician uploads
      │
      [Upload Results] button per test
        ├── Upload CBC results (PDF or image)
        └── Upload LFT results (PDF or image)
      │
      [Mark All Results Uploaded] → Final confirmation
              │
              ✅ Reports saved to patient record
              ✅ Doctor notified: "Sneha Reddy's lab reports are ready"
              ✅ Patient notified: "Your lab reports are ready. View in your records."
              ✅ Patient sees option: E-Consult (free) or Book Revisit
```

---

## 4. Upload Results Screen

```
Patient: Sneha Reddy — 13 July 2026

CBC — Complete Blood Count
  [Upload file: PDF / JPG / PNG]  [Drag & drop]
  Optional notes: [text field for technician remarks]
  [Save CBC Results]

LFT — Liver Function Test
  [Upload file: PDF / JPG / PNG]  [Drag & drop]
  Optional notes: [text field]
  [Save LFT Results]

[Mark All Results Uploaded & Notify Patient]
```

---

## 5. Status Tracking

Each test slot goes through these states:

```
Booked (payment pending)
      ↓
Confirmed (payment done — visible to technician)
      ↓
Sample Collected
      ↓
Results Uploaded
      ↓
Patient Notified ✅
```

---

## 6. What Lab Technician Does NOT Do

- Does NOT place test orders (doctor does that)
- Does NOT collect payment (patient pays via app or reception)
- Does NOT prescribe or interpret results clinically
- Does NOT communicate directly with doctor (system handles notification)

---

## 📌 Notes for Developer

- **File uploads:** Accept PDF, JPG, PNG. Store securely. Generate a viewable link for patient app and doctor workspace.
- **Notification trigger:** Happens automatically when technician clicks "Mark All Results Uploaded". Must notify both patient AND doctor.
- **Pending payment slots:** Show in list but greyed out — technician cannot start them. This prevents technician from working without confirmed payment.
- **Multiple tests per slot:** A single slot can have multiple tests. Each test is uploaded separately.
- **No manual payment:** Technician has no payment UI. If a patient shows up without confirmed payment, they must go to reception to pay first.
- **Report visibility:** Reports visible to patient (read-only in Records section) and to doctor (in Patient 360 and E-Consult view).
