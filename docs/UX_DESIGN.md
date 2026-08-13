# ClinIQ — UX Design Specification

_Smart Hospital Platform · role-based clinical operations + AI copilot_

This document specifies the user experience of the ClinIQ frontend: design
principles, the visual design system, information architecture, component
library, role-based workspaces, key user flows, and a design-token appendix.

Source of truth in code:
- Shell & navigation — `frontend/src/components/Layout.tsx`
- Routes — `frontend/src/App.tsx`
- Component library — `frontend/src/components/ui.tsx`
- Design system / tokens — `frontend/src/index.css`

---

## 1. Product & UX Goals

ClinIQ is a **role-based hospital operations platform** that follows a single
patient through the entire care journey — check-in → triage → doctor → lab →
pharmacy → billing — with real-time coordination and AI clinical assistance
layered throughout.

UX north stars:

- **One patient, many desks** — each role sees the same patient through a lens
  tuned to its job.
- **Ambient awareness** — live queues, alerts, and event streams keep every desk
  in sync without manual refresh.
- **Trust in AI** — AI suggestions are always _labeled, explainable, and
  advisory_ (never silent automation).
- **Calm, premium clinical surface** — a light, glassy, low-noise canvas so
  clinicians focus on data, not chrome.

---

## 2. Design Principles

| Principle | How it shows up |
|---|---|
| Clarity over decoration | High-contrast data, tabular numerals, quiet uppercase table headers |
| Progressive disclosure | Collapsible sub-nav, expandable patient sessions, modal deep-dives |
| Status is first-class | `LIVE` dots, colored tags, event stream, audit trail |
| Consistent per-role color | Every workspace has one signature color on its tile, nav icon, and headers |
| Advisory AI | `AgentBadge` (“✦ Live”) marks any AI-generated content |
| Accessible by default | Keyboard focus rings, semantic roles, color never used alone |

---

## 3. Visual Design System

### Brand & palette

Microsoft communication-blue brand on a **warm premium canvas**.

| Token | Value | Use |
|---|---|---|
| Accent (rest) | `#0078d4` | Primary actions, links, active nav |
| Accent (hover) | `#106ebe` | Hover state |
| Accent (deep) | `#004578` | Pressed / focus outline |
| Canvas base | `#f6f4ef → #fbfaf7` | Warm pearl/ivory page background |
| Ambient wash | sapphire `#173a6e` · indigo `#3a4a78` · champagne `#b8945f` (all low-alpha) | Liquid-glass color field |
| Ink | `#14213d` / `#1f2937` | Body text |
| Gold accent | `#b8945f` / `#d9c39a` | Premium highlights, warm sheen |

**Per-role accent colors** (nav icon, workspace tile, panel headers):

| Role | Route | Color |
|---|---|---|
| Home / general | `/` | `#0078D4` blue |
| Triage | `/triage` | `#D13438` red |
| Doctor Workspace | `/copilot` | `#038387` teal |
| Oncology & Cancer Care | `/oncology` | `#8764B8` violet |
| Lab Workspace | `/lab` | `#107C10` green |
| Pharmacy Desk | `/pharmacy` | `#CA5010` orange |
| Reception Desk | `/reception` | `#4F6BED` indigo |
| Command Center | `/command` | `#004E8C` deep blue |
| Admin Workspace | `/admin` | `#5C2E91` purple |

### Surfaces — “Liquid Glass”

Panels are translucent frosted glass: `backdrop-filter: blur(24px) saturate(160%)`
over a warm-white gradient (`rgba(255,255,253,.88) → rgba(250,248,243,.72)`), with
a glossy specular top edge, a champagne-gold inner floor sheen, and a soft layered
shadow. Cards lift on hover. **Buttons are also liquid glass** — translucent with
blue text and a light glass hover (no solid dark fill).

### Typography

Segoe UI Variable first (authentic Fluent rendering on Windows), Inter fallback.
Tight heading letter-spacing (`-0.018em`); **tabular numerals** for all metrics,
key-values, and tables.

### Depth, geometry & motion

- Fluent 2 neutral elevation ramp + restrained radius scale (glass panels 16px).
- `framer-motion` route transition: content fades and rises (`opacity 0→1, y:8`,
  ~0.25s) on every navigation.
- Micro-feedback: recording waveforms, pulsing live dots, hover lifts.

### Iconography

`lucide-react`, one icon per domain, tinted with the role color.

---

## 4. Information Architecture

```
ClinIQ Shell  (Sidebar + Top bar + Waffle App launcher)
├── Home                    /              live snapshot + workspace tiles
├── Reception Desk          /reception     receptionist
├── Triage Desk             /triage        nurse
├── Doctor Workspace        /copilot       doctor  (AI copilot)
├── Oncology & Cancer Care  /oncology      doctor
├── Lab Workspace           /lab           lab
├── Pharmacy Desk           /pharmacy      pharmacist
├── Command Center          /command       admin   (live monitoring)
├── Admin Workspace         /admin         admin
└── Patient Portal (auth-gated via RequirePatient)
    ├── Login               /patient/login
    ├── Dashboard           /patient
    ├── Check-in            /patient/checkin
    ├── Book Appointment    /patient/appointments/book
    └── Oncology Care       /patient/oncology
```

**Navigation model** — persistent left **sidebar** (role-colored nav; active item
= tinted pill + inset accent bar), a **top bar** (brand tile, connection status,
waffle **App launcher** popover of all workspaces as colored tiles, and an
active-session card that carries the current patient across desks), and a
scrolling **content region**. Patient Portal routes are guarded and redirect to
`/patient/login` when unauthenticated.

---

## 5. Layout System

- **Shell**: fixed sidebar (off-canvas drawer on mobile via hamburger) + sticky
  top bar + scrolling `motion.main`.
- **Home**: hero band → **Live hospital snapshot** (4 KPI metric tiles) →
  **Explore workspaces** (colored app-tile grid).
- **Workspaces**: consistent pattern — _KPI metric row → primary work panel(s) →
  live/side rails_.
- **Responsive**: sidebar collapses to a drawer; tile grids reflow
  `grid-cols-2 → md:grid-cols-4`; the app launcher is a right-anchored popover.

---

## 6. Core Component Library (`ui.tsx`)

| Component | UX role |
|---|---|
| `Card` | Base liquid-glass surface for every panel |
| `Metric` | KPI tile — value + label + optional colored icon chip & top accent strip |
| `SectionTitle` | Panel header with optional subtitle |
| `Tag` | Colored status pill (blue / red / mint …) |
| `AgentBadge` | “✦ Live” marker for AI-generated content |
| `Ring` | Circular progress / score gauge |
| `Wave` | Live audio waveform (voice capture / ASR) |
| `LiveDot` | Pulsing real-time indicator |
| `DeviceBar` | Faux device/URL chrome for embedded views |
| `Field` / `Empty` | Labeled form row / empty-state placeholder |

---

## 7. Role-Based Workspaces

- **Reception** — front-desk queue, registration, today's appointments; metrics
  for arrivals / queue / wait.
- **Triage** — nurse ESI acuity assessment, vitals capture, staff & recent-
  encounter rails; red urgency accent.
- **Doctor Workspace (“Copilot”)** — encounter view with voice capture
  (`Wave` / ASR), patient360 context, and AI **formulary guidance** (Gemini)
  shown as labeled, explainable recommendations cross-checked against pharmacy
  stock.
- **Oncology & Cancer Care** — diagnoses, radiology/pathology reports,
  survivorship plans; violet accent for a distinct, sensitive domain.
- **Lab** — order worklist, specimen/result entry, imaging (DICOM) handling.
- **Pharmacy** — stock levels, prepaid balances, dispensing against orders.
- **Command Center** — hospital-wide monitoring with colored panel headers:
  **Queue load** (blue), **Live alerts** (red, `✦ Live`), **Domain event stream**
  (teal), **Audit trail** (purple), fed by WebSocket `/ws/stream` + metric polling.
- **Admin** — doctors, lab schedules, configuration and governance.
- **Patient Portal** — patient-facing check-in, dashboard, appointment booking,
  and oncology care, with a test-payment modal for billing flows.

---

## 8. Signature User Flow — The Patient Journey

```
Patient ─ check-in ─▶ Reception ─ queue ─▶ Triage (vitals + ESI)
   ─ assign ─▶ Doctor + AI Copilot (voice note, patient360, formulary guidance)
   ─ order ─▶ Lab ─ results ─▶ Doctor ─ prescribe ─▶ Pharmacy (stock-checked)
   ─▶ dispense to Patient
        ▲
        └─ Command Center: live queue, alerts, event stream & audit update
           in real time throughout
```

The **active-session card** in the top bar carries the current patient across
desks, so any role can pick up context instantly.

---

## 9. Real-Time & AI UX Patterns

- **Live data** — WebSocket `/ws/stream` + periodic metric polling drive queues,
  alerts, and the event stream with no user action; `LiveDot` signals “this is
  live.”
- **AI transparency** — every AI output is wrapped in an `AgentBadge`, states its
  clinical rationale, and is cross-referenced against real data (e.g. prescribed
  drug ↔ pharmacy stock). AI is advisory, never auto-applied.

---

## 10. Accessibility

- App-wide keyboard focus rings (2px accent outline on `:focus-visible`) and
  Fluent field focus strokes.
- Semantic dialog roles; `aria-label` / `aria-expanded` on chrome controls
  (hamburger, app launcher, collapsible nav).
- Opaque dropdown menus for legibility on the glass surface.
- Color is never the only signal — tags pair color with icon + text; contrast is
  tuned for the light canvas.

---

## Appendix A — Design Tokens (quick spec sheet)

```txt
Accent            #0078d4   hover #106ebe   deep #004578
Canvas base       linear-gradient(180deg, #f6f4ef, #fbfaf7)
Ambient wash      sapphire  rgba(23,58,110,.10)
                  indigo    rgba(58,74,120,.08)
                  champagne rgba(184,148,95,.09)
                  steel     rgba(30,86,140,.07)
Glass panel       linear-gradient(135deg, rgba(255,255,253,.88), rgba(250,248,243,.72))
                  backdrop-filter: blur(24px) saturate(160%)
                  border: 1px solid rgba(255,255,255,.75)
                  radius: 16px
                  shadow: 0 14px 38px rgba(28,33,51,.10), 0 2px 6px rgba(28,33,51,.05)
                          + inset gold floor sheen rgba(184,148,95,.16)
Glass button      bg rgba(255,255,255,.62→.36) · blur(16px) · text #0a5aa8
                  hover rgba(.74→.48) · border rgba(0,120,212,.45) · text #0a4f92
Gold accent       #b8945f   soft #d9c39a
Ink               #14213d / #1f2937
Font              "Segoe UI Variable Text", "Segoe UI", Inter, system-ui
Motion (page)     opacity 0→1, y:8 → 0   ~0.25s
```

## Appendix B — Role Color Reference

```txt
Home        #0078D4      Lab          #107C10
Triage      #D13438      Pharmacy     #CA5010
Doctor      #038387      Reception    #4F6BED
Oncology    #8764B8      Command      #004E8C
                         Admin        #5C2E91
```
