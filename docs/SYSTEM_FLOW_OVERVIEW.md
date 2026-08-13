# ClinIQ — Complete System Flow Overview

> This document describes the **full end-to-end patient journey** across all modules.
> Read this first before diving into any workspace-specific documentation.

---

## 🏗️ System Architecture (Who Does What)

| Module / Portal | Used By | Responsibility |
|---|---|---|
| **Patient App** | Patient | Booking, check-in, triage status, room guidance, records, lab reports, e-consult, pharmacy QR |
| **Receptionist UI** | Front Desk Staff | Walk-in registration, check-in assist, lab slot booking, cash payment collection |
| **Triage / Nurse UI** | Nurse | Enter vitals, mark triage complete, update patient status |
| **Doctor Workspace** | Doctor | Patient 360, SOAP notes, AI Summary, Prescription, CDS, Orders & Labs, Discharge |
| **Lab Portal** | Lab Technician | View booked slots, confirmed payments, collect samples, upload reports |
| **Pharmacy Module** | Pharmacist | View prescription via patient mobile number, mark medicines dispensed |
| **Admin / Command Center** | Hospital Admin | Live ops dashboard, queue status, revenue analytics, anomaly alerts |

---

## 🔄 High-Level Patient Journey

```
Book Appointment (pay online) ──► Hospital Arrival
                                        │
                              ┌─────────┴──────────┐
                         Self Check-in        Reception Check-in
                              └─────────┬──────────┘
                                        │
                                   Triage Desk
                                  (Vitals entered)
                                        │
                                  Doctor's Room
                                        │
                          ┌─────────────┴─────────────┐
                    No Lab Required              Lab Tests Required
                          │                            │
                   Prescription                  Orders placed
                   CDS Check                     Patient discharged
                   Discharge                     Patient books lab slot
                   Record auto-created                 │
                          │                    Lab test performed
                          │                    Reports uploaded by technician
                          │                    Patient notified
                          │                            │
                          │                  ┌─────────┴──────────┐
                          │             E-Consult (FREE)    Live Revisit
                          │            Patient sends         Patient books new
                          │            reports to doctor     slot (paid)
                          │            Doctor reviews &      Same physical flow
                          │            writes Rx online      repeats
                          │                  │
                          └──────────────────┘
                                        │
                                   Pharmacy
                             (hospital or outside)
                      Patient gives mobile number →
                      Pharmacist sees prescription →
                      Medicines dispensed
```

---

## 💳 Payment Model

| Payment Point | What | Who Pays | Channel |
|---|---|---|---|
| Appointment booking | Consultation fee | Patient | Online (Patient App) |
| Walk-in | Consultation fee | Patient | Reception (cash / UPI / card) |
| Lab tests | Lab charges | Patient | Online (app) OR Reception |
| E-consult after lab reports | **FREE — once** | — | — |
| Follow-up live visit | New consultation fee | Patient | Online booking |
| Pharmacy | Medicine cost | Patient | Pharmacy directly |

---

## ⚠️ Key Design Principles (Follow These Always)

1. **Payment before service** — Consultation confirmed only after payment. Lab slot confirmed only after payment.
2. **Doctor never handles payment** — Doctor's billing tab is READ-ONLY. Shows what was paid + method. No payment buttons ever.
3. **AI assists, doctor decides** — AI Summary and CDS are suggestions only. Doctor approves everything.
4. **Patient always knows where to go** — Patient app shows real-time status at every step: triage → room number + floor.
5. **Records auto-created on discharge** — Doctor clicks Discharge → patient record + prescription auto-pushed to patient app + ABDM PHR silently.
6. **Lab reports flow back** — After technician uploads, doctor notified + patient can trigger e-consult (free) or book live revisit (paid).
7. **Walk-ins are supported** — Receptionist creates profile, books slot, patient goes directly to triage.

---

## 📁 Documentation Index

| File | Audience | Covers |
|---|---|---|
| `SYSTEM_FLOW_OVERVIEW.md` | **All team** | This file — full journey + design principles |
| `WORKSPACE_PATIENT_TRIAGE.md` | **Teammate** | Patient App + Receptionist UI + Triage/Nurse UI |
| `WORKSPACE_DOCTOR.md` | **You** | Doctor Workspace — all tabs and flows |
| `WORKSPACE_LAB.md` | **You** | Lab Technician Portal |
| `WORKSPACE_PHARMACY.md` | **You** | Pharmacy Module |
| `WORKSPACE_ADMIN.md` | **You** | Admin / Command Center |
