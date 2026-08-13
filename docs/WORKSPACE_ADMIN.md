# ClinIQ — Admin / Command Center

> **Audience:** Admin portal developer
> Read `SYSTEM_FLOW_OVERVIEW.md` first for the big picture.

---

## Overview

The Admin / Command Center gives hospital management a **live operational view** of everything happening in the hospital — queues, revenue, doctor load, lab status, and system health.

This is a **read-only analytics + alerting** dashboard. Admins do not perform clinical actions.

---

## 1. Main Dashboard — Live OPD Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ClinIQ — Command Center            13 July 2026 | 11:42 AM           │
├──────────────────────┬───────────────────────────────────────────────────┤
│  TODAY'S SNAPSHOT    │  LIVE QUEUE MAP                                   │
│                      │                                                   │
│  Total Patients: 48  │  Dr. Mehta (Gen. Med)    ████████░░  8/10        │
│  Checked In:     31  │  Dr. Sharma (ENT)        █████░░░░░  5/10        │
│  With Doctor:    12  │  Dr. Reddy (Cardio)      ██████████  10/10 🔴    │
│  Discharged:     19  │  Dr. Nair (Ortho)        ████░░░░░░  4/10        │
│  Waiting:        17  │                                                   │
│                      │  Triage Queue:  3 waiting                         │
│  Avg Wait Time:      │  Lab Queue:     5 waiting                         │
│  Triage:  4 min      │                                                   │
│  Doctor:  18 min     │                                                   │
└──────────────────────┴───────────────────────────────────────────────────┘
```

---

## 2. Revenue Summary

```
┌─────────────────────────────────────────────────────────┐
│  Revenue — Today (13 July 2026)                         │
│                                                         │
│  Consultation Fees:        ₹24,000                      │
│  Lab Charges:              ₹18,600                      │
│  Total Collected:          ₹42,600                      │
│                                                         │
│  Payment Breakdown:                                     │
│  ├── UPI:         ₹28,400  (67%)                        │
│  ├── Cash:        ₹9,200   (22%)                        │
│  └── Card:        ₹5,000   (11%)                        │
│                                                         │
│  Pending (booked, not yet arrived): ₹7,500              │
│  Cancelled today: ₹1,000                                │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Doctor Load & Performance

```
┌────────────────────┬──────────┬──────────┬───────────┬───────────────┐
│ Doctor             │ Seen     │ Pending  │ Avg Time  │ Status        │
├────────────────────┼──────────┼──────────┼───────────┼───────────────┤
│ Dr. Mehta (GenMed) │ 8        │ 5        │ 12 min    │ 🟢 On Schedule│
│ Dr. Sharma (ENT)   │ 5        │ 3        │ 18 min    │ 🟡 Slight delay│
│ Dr. Reddy (Cardio) │ 10       │ 8        │ 22 min    │ 🔴 Overloaded  │
│ Dr. Nair (Ortho)   │ 4        │ 2        │ 15 min    │ 🟢 On Schedule│
└────────────────────┴──────────┴──────────┴───────────┴───────────────┘
```

---

## 4. Lab Operations Status

```
┌──────────────────────────────────────────────────────┐
│  Lab Status — Today                                  │
│                                                      │
│  Total Tests Ordered:    34                          │
│  Slots Booked & Paid:    28                          │
│  Sample Collected:       21                          │
│  Results Uploaded:       16                          │
│  Reports Pending:        12                          │
│                                                      │
│  Oldest pending result: 3.5 hours ⚠️               │
│                                                      │
│  Upcoming Lab Slots:                                 │
│  2:00 PM — 4 patients                               │
│  3:00 PM — 3 patients                               │
└──────────────────────────────────────────────────────┘
```

---

## 5. Alerts & Anomalies

The system automatically raises alerts that the admin sees:

```
🔴 CRITICAL
  - Dr. Reddy (Cardio) queue at 100% capacity — 8 patients waiting
  - Lab result for Token A-047 pending for 4+ hours

🟡 WARNING
  - Average triage wait time exceeded 10 min in last 30 min
  - 3 no-shows for morning slots (₹1,500 in uncollected revenue)

🟢 INFO
  - 19 patients discharged successfully today
  - ABDM PHR sync: 17/19 successful, 2 pending
```

---

## 6. Patient Flow Timeline (Today)

Visual timeline showing all patients' journey through the hospital:

```
Token  | Patient         | Booked  | Check-in | Triage  | Doctor  | Discharge
A-061  | Ramesh Kumar    | 10:00AM | 09:48AM  | 09:52AM | 10:05AM | 10:17AM  ✅
A-062  | Priya Singh     | 10:15AM | 10:02AM  | 10:08AM | 10:20AM | — (active)
A-063  | Vikram Nair     | 10:30AM | 10:25AM  | 10:31AM | —       | —
A-064  | Sneha Reddy     | 11:00AM | 10:55AM  | 11:02AM | —       | —
```

---

## 7. ABDM / PHR Sync Status

```
┌──────────────────────────────────┐
│  ABDM Sync — Today               │
│                                  │
│  Records to push:   19           │
│  Successfully synced: 17         │
│  Failed / Pending:   2           │
│                                  │
│  Failed records:                 │
│  - Token A-052 (retry pending)   │
│  - Token A-059 (ABHA mismatch)   │
│                                  │
│  [Retry Failed Syncs]            │
└──────────────────────────────────┘
```

---

## 8. Weekly / Monthly Reports (Downloadable)

Admin can download:
- Total patients seen (by doctor, by department, by date range)
- Revenue report (by payment method, by date)
- Lab utilization report
- Average wait times
- No-show rate

All reports downloadable as **CSV / PDF**.

---

## 📌 Notes for Developer

- **Read-only dashboard** — no admin action modifies patient or clinical data.
- **Real-time data** — use WebSocket or short polling (10-15 sec) for live queue and alert updates.
- **Role-based access** — admin sees all doctors, all departments. A department head might see only their department (future scope).
- **Alerts** are auto-generated by the system based on thresholds (e.g., queue > 80%, result pending > 3 hours).
- **[Retry Failed Syncs]** is the only actionable button — triggers background ABDM sync retry.
- **Revenue data** — sourced from confirmed payments at booking time and at reception. Not from doctor workspace.
- **No patient PHI in bulk views** — patient names visible only in individual row detail, not in aggregate charts.
