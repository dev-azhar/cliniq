# ClinIQ — Smart Hospital Patient Journey Platform

> A futuristic, **100% open-source**, ABDM/ABHA-ready, agentic-AI platform that orchestrates the
> full outpatient (OPD) journey — from **queue-free digital check-in** to **digital discharge** —
> with a **clinician-in-the-loop** safety model. Built so patients never struggle.

<p align="center">
  <b>Check-in → Identity → Consent → Patient 360 → AI Triage → Doctor Copilot (Ambient SOAP) →
  Smart Orders → Lab AI → Rx CDS → Pharmacy → Billing → Discharge → Command Center</b>
</p>

---

## Why this is different

- **Agentic AI mesh** — Intake, Triage, Ambient-Docs, Lab-Intelligence, Rx-CDS, Compliance and
  Command-Center agents, each with an **always-on guardrail layer** and a **human-approval gate**.
  Agents *draft and advise*; a clinician *approves every* note, order and prescription.
- **Runs anywhere, needs no GPU to demo** — the AI Model Gateway talks to **self-hosted Ollama**
  when available and **falls back to a deterministic clinical engine** so every feature works out
  of the box.
- **Interoperable by design** — FHIR R4 canonical model, LOINC/SNOMED/ICD-10 coding, ABDM connector
  stubs (ABHA / Consent / HIP / HIU / PHR).
- **Consent-first & auditable** — no PHI read without a valid, time-bound, revocable consent
  artifact; every action written to an immutable audit log (DPDP-aligned).
- **A UI from the future** — glass/HUD design language, live telemetry, holographic panels,
  ambient waveform capture, ESI acuity rings.

## Architecture at a glance

A **modular monolith** whose modules map 1:1 to the microservices catalog in the Solution
Architecture. Each domain owns its data; modules talk via an in-process **event bus** (drop-in
replaceable with Kafka). This is runnable *today* and extractable to true microservices later.

```
frontend (React + Vite + Tailwind, HUD design system)
   │  REST / JSON
backend (FastAPI)
   ├─ api/            journey · clinical · billing · command · ai routers
   ├─ ai/             model gateway (Ollama + fallback) · agents · guardrails · knowledge (RAG)
   ├─ core/           config · database · event bus · security/audit
   └─ models/         FHIR-aligned domain model (PostgreSQL / SQLite)
```

## Tech stack (all open source)

| Layer        | Technology |
|--------------|-----------|
| Frontend     | React 18, TypeScript, Vite, TailwindCSS, Framer Motion, TanStack Query, Recharts, lucide-react |
| Backend      | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn |
| AI & Deep Learning | PyTorch, TorchXRayVision (DenseNet-121), MONAI 3D, Pydicom, Ollama / Gemini / Grok Gateway |
| Data         | PostgreSQL (prod) / SQLite (zero-setup dev), Redis (cache/queue), event bus (→ Kafka) |
| Interop      | FHIR R4, LOINC / SNOMED CT / ICD-10, ABDM connector stubs |
| Platform     | Docker Compose, GitOps-ready |

## Quick start (zero-setup dev — no Docker, no GPU)

```bash
# 1) Backend Setup
cd backend
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/Mac:
source .venv/bin/activate

# Install all dependencies (including PyTorch vision, MONAI, and DICOM parsers)
pip install -r requirements.txt

python -m uvicorn app.main:app --reload # http://localhost:8000 (docs at /docs)

# 2) Frontend Setup (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Open **http://localhost:5173** and walk the full patient journey.

### 🧬 Local PyTorch Diagnostic AI & DICOM Vision Pipeline

The platform includes a local deep-learning computer vision & pathology engine for instant, privacy-first diagnostic evaluation:

- **Radiology (X-Ray)**: Evaluated by PyTorch **TorchXRayVision** (DenseNet-121 trained on NIH ChestX-ray14 & CheXpert) for pneumothorax, opacity, effusion, and fractures.
- **CT / MRI Scans & DICOM Files**: Native DICOM medical image parsing (`pydicom`) fed into **MONAI 3D Volumetric Tensor Engine** for nodule, hemorrhage, and soft tissue analysis.
- **Pathology & Blood Reports**: Evaluated by **Biological Reference Range Engine** for numeric threshold validation (CBC, CRP, HbA1c, Glucose, LFT, RFT).
- **Doctor-Only AI Privacy**: Local PyTorch AI outputs are saved in a dedicated `ai_analysis_summary` database field visible **exclusively in the Doctor Workspace** and stripped from patient-facing views.

### Razorpay test cards

Use these cards only with Razorpay **Test Mode** keys. No real money is charged. For every card,
enter any random CVV and any future expiry date.

| Network | Card number | CVV and expiry date |
|---------|-------------|---------------------|
| Visa | `4100 2800 0000 1007` | Random CVV and any future date |
| Mastercard | `5500 6700 0000 1002` | Random CVV and any future date |
| RuPay | `6527 6589 0000 1005` | Random CVV and any future date |
| Diners | `3608 280009 1007` | Random CVV and any future date |
| Amex | `3402 560004 01007` | Random CVV and any future date |

### Optional — real self-hosted LLM

```bash
# Install Ollama from https://ollama.com then:
ollama pull llama3.2
# backend picks it up automatically via OLLAMA_BASE_URL / OLLAMA_MODEL
```

### Full stack with Docker (Postgres + Redis + Ollama + app)

```bash
docker compose up --build
# frontend :5173 · backend :8000 · postgres :5432 · redis :6379 · ollama :11434
```

## The seven AI agents

| Agent | Function | Human gate |
|-------|----------|-----------|
| Intake | Conversational symptom capture, red-flag detection | Nurse/doctor reviews |
| Triage | ESI acuity, specialty & doctor match, queueing | Nurse can override |
| Ambient Docs | Transcribe encounter → draft SOAP + ICD-10 | Doctor approves before commit |
| Lab Intelligence | Local PyTorch DICOM/X-ray vision & pathology report analyzer | Doctor verifies |
| Rx CDS | Anonymized generic formulation guidance & stock reservation | Doctor approves & e-signs |
| Compliance | Documentation completeness & gap detection | Officer resolves/waives |
| Command-Center | Live ops analytics & anomaly alerts | Ops acts on recommendations |
| Compliance | Documentation completeness & gap detection | Officer resolves/waives |
| Command-Center | Live ops analytics & anomaly alerts | Ops acts on recommendations |

## Safety & compliance

- **No autonomous clinical action.** AI draft *and* approved version are both retained for audit.
- **Consent enforced** at the API boundary before any PHI read.
- **DPDP Act 2023** aligned: purpose limitation, data-principal rights, immutable audit trail.
- **Data residency**: self-hosted, India-region friendly.

## Repository layout

```
smart-hospital-platform/
├── backend/        FastAPI service (domain modules, AI mesh, FHIR model)
├── frontend/       React HUD experience (check-in, triage, copilot, pharmacy, command center)
├── docker-compose.yml
└── docs/           Solution Architecture (companion)
```

---

_ClinIQ · v0.1 · open-source · built for a queue-free, AI-assisted, human-approved hospital._
