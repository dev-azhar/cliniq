# ClinIQ — Patient App + Receptionist UI + Triage/Nurse UI

> **Audience:** Teammate working on Patient & Triage sections
> **Covers:** Patient App, Receptionist UI, Triage Nurse UI
> Read `SYSTEM_FLOW_OVERVIEW.md` first for the big picture.

---

## 1. 📱 Patient App

### 1.1 Appointment Booking Flow

```
Patient opens app (new or returning)
      │
      ├── Search: Department / Doctor / Symptom
      ├── Select Doctor → View profile, specialization, availability
      ├── Select Date → See available slots (real-time)
      ├── Select Time Slot
      ├── Review: Doctor, Date, Time, Fee
      ├── Pay online (UPI / Card / Net Banking)
      └── CONFIRMED only after successful payment
              │
              ▼
      Patient receives:
        - Confirmation notification
        - Token number assigned
        - Hospital name + address
        - "What to bring" checklist
```

**Rules:**
- A slot is NOT reserved until payment is successful
- Patient can book for today (if slots available) or any future date
- Cancellation / rescheduling policy: TBD (plan later)

---

### 1.2 Walk-in Patient Flow (via Receptionist)

```
Patient walks in without prior booking
      │
      Receptionist:
      ├── Takes patient mobile number
      ├── Looks up or creates patient profile
      ├── Selects available doctor + slot (today)
      ├── Collects payment (cash / UPI / card) at reception
      └── Confirms appointment
              │
              ▼
      Patient gets notification:
        - Appointment confirmed
        - "Proceed to Triage Desk"
```

---

### 1.3 Hospital Arrival — Check-In

```
Patient arrives at hospital
      │
      ├── Option A: Self Check-in (Patient App)
      │       └── Taps "I've Arrived" / "Check In" on their appointment card
      │
      └── Option B: Reception Check-in
              └── Patient tells receptionist they've arrived
                  Receptionist clicks Check-in on that patient

      Result in both cases:
        ✅ Token status updates to "Checked In"
        ✅ Patient App shows: "Proceed to Triage Desk"
        ✅ Triage nurse queue updates with this patient
```

---

### 1.4 Real-Time Status Screen (Patient App)

The patient app must show a live status card for the current visit:

```
┌────────────────────────────────────┐
│  Your Visit — Token A-064          │
│  Dr. Ananya Mehta | General Med    │
│                                    │
│  ● Checked In ✅                   │
│  ● Triage ── IN PROGRESS 🔄        │
│  ● Doctor Visit ── WAITING         │
│                                    │
│  📍 After triage → Room 101, Fl 1  │
│  ⏱ Estimated wait: ~10 mins        │
└────────────────────────────────────┘
```

Status progression:
1. `Booked` → 2. `Checked In` → 3. `At Triage` → 4. `Triage Done` → 5. `Doctor Visit` → 6. `Discharged`

---

### 1.5 After Doctor Discharge — Patient Records

When doctor clicks Discharge, **automatically** create in patient app:

```
Visit Record Card — July 13, 2026
├── Doctor: Dr. Ananya Mehta
├── Diagnosis: Pharyngitis (ICD: J02.9)
├── Doctor's Notes: [SOAP notes from doctor]
├── Prescription:
│     - Azithromycin 500mg × 5 days (after food)
│     - Paracetamol 650mg SOS
├── Next Steps: Rest, hydration, follow up if no improvement in 3 days
└── [Download PDF] [Share]
```

- Patient gets push notification: *"Your visit summary is ready"*
- Record is permanent and viewable anytime in **Records** section
- ABDM PHR updated silently in background

---

### 1.6 Lab Reports Flow (Patient Side)

```
After doctor orders lab tests and discharges:
      │
      Patient app shows notification:
      "Lab tests ordered. Please complete payment and book slot."
              │
      Patient taps notification → sees:
        ┌──────────────────────────────────┐
        │ Tests Ordered                    │
        │  • CBC — ₹250                    │
        │  • LFT — ₹350                    │
        │  Total: ₹600                     │
        │                                  │
        │ Select Slot:  [Today] [Tomorrow] │
        │ 10:00 AM  11:00 AM  2:00 PM      │
        │                                  │
        │ [Pay & Confirm Slot]             │
        └──────────────────────────────────┘
              │
      Payment success → Slot confirmed
      Patient gets: slot time + lab location/room
              │
      When reports are ready (same day or next day):
      Patient gets notification: "Your lab reports are ready"
              │
      Patient views reports in Records section
              │
      Patient sees two options:
        ┌─────────────────────────────────────┐
        │ What would you like to do?          │
        │                                     │
        │ [📹 E-Consult — Free]               │
        │  Send reports to Dr. Ananya Mehta   │
        │  Doctor reviews & prescribes online │
        │                                     │
        │ [🏥 Book Revisit]                   │
        │  Visit doctor in person             │
        │  Select date & slot (paid)          │
        └─────────────────────────────────────┘
```

---

### 1.7 E-Consult Flow (Patient Side)

```
Patient selects "E-Consult — Free"
      │
      Confirmation: "Send your reports to Dr. Ananya Mehta?"
      [Confirm]
              │
      ✅ Reports sent to doctor's review queue
      Patient sees: "Waiting for doctor to review"
              │
      Doctor reviews and writes prescription
              │
      Patient notified: "Dr. Mehta has reviewed your reports"
      Patient sees final prescription in Records
```

---

## 2. 🖥️ Receptionist UI

### 2.1 Key Responsibilities

| Task | Action |
|---|---|
| Walk-in registration | Create patient profile, book slot, collect payment |
| Check-in assist | Mark patient as arrived when they come to desk |
| Lab payment | Collect cash for lab tests, confirm slot |
| Queue view | See all today's patients, their status, assigned doctor |

### 2.2 Walk-in Registration Screen

```
Fields:
  - Mobile Number (primary identifier — auto-lookup returning patients)
  - Full Name
  - Age / DOB
  - Gender
  - ABHA ID (optional)
  - Chief Complaint (brief)

Then:
  - Select Department → Select Doctor
  - See available today slots → Select slot
  - Collect payment → Mark as paid
  - [Confirm & Check-In] → Patient goes directly to triage
```

### 2.3 Today's Patient Queue View

Receptionist should see a live table:
```
Token | Patient Name  | Doctor         | Status        | Action
A-061 | Ramesh Kumar  | Dr. Mehta      | With Doctor   | —
A-062 | Priya Singh   | Dr. Mehta      | Triage Done   | —
A-063 | Vikram Nair   | Dr. Mehta      | At Triage     | —
A-064 | Sneha Reddy   | Dr. Mehta      | Checked In    | [Check-In]
A-065 | Arjun Pillai  | Dr. Mehta      | Booked        | —
```

---

## 3. 🩺 Triage / Nurse UI

### 3.1 Triage Queue

Nurse sees all patients checked in and awaiting triage:

```
Token | Patient Name | Age | Appointment | Chief Complaint | Action
A-064 | Sneha Reddy  | 28F | 11:00 AM    | Sore throat     | [Start Triage]
A-065 | Arjun Pillai | 45M | 11:15 AM    | Chest pain      | [Start Triage]
```

### 3.2 Vitals Entry Screen

```
Patient: Sneha Reddy — Token A-064 — Dr. Ananya Mehta

Vitals:
  Blood Pressure:  ___ / ___ mmHg
  Heart Rate:      ___ bpm
  Temperature:     ___ °F / °C
  SpO2:            ___ %
  Weight:          ___ kg
  Height:          ___ cm (first visit only)
  BMI:             [auto-calculated]

Chief Complaint (nurse note):
  [text field]

[Save & Complete Triage]
```

### 3.3 After Completing Triage

```
[Save & Complete Triage] clicked
      │
      ✅ Vitals saved to patient record
      ✅ Doctor's queue updates — patient now visible
      ✅ Patient App updates:
            "Triage complete. Proceed to Room 101, Floor 1"
            "Dr. Ananya Mehta | Estimated wait: ~10 mins"
      ✅ Token status → "Triage Done"
```

### 3.4 Alert for Critical Vitals

If nurse enters critical values, system should flag:
- SpO2 < 90% → 🔴 ALERT — flag as urgent
- BP > 180/120 → 🔴 ALERT — escalate
- Temp > 104°F → 🟡 WARNING

These flags should be visible to both nurse and doctor.

---

## 📌 Notes for Teammate

- **Mobile number is the primary patient identifier** — used everywhere (check-in, pharmacy, etc.)
- **Patient app status must update in real-time** — use WebSocket or polling
- **After discharge, records are READ-ONLY** for the patient — they cannot edit
- **E-consult is free exactly once** per lab order episode — after that, booking a revisit requires payment
- **Walk-in patients skip the online booking step** but otherwise follow the same triage → doctor flow
