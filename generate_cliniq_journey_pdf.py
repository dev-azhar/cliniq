"""Generate the ClinIQ end-to-end Patient Journey PDF (onboarding → discharge).

One narrative deck walking a real patient through every stage — login, appointment,
check-in, token & queue, reception, triage, doctor, lab, pharmacy and discharge —
using live screenshots captured from the running app (docs/journey/*.png).

Run:  backend/.venv/bin/python generate_cliniq_journey_pdf.py
Output: docs/ClinIQ_Patient_Journey.pdf
"""
from __future__ import annotations

from pathlib import Path

from PIL import ImageDraw

# Reuse the shared styling helpers/palette from the summary generator.
from generate_cliniq_pdf import (
    PW, PH, NAVY, NAVY_SOFT, BLUE, TEAL, EMERALD, INK, MUTED, LIGHT, LINE, WHITE,
    font, text_w, wrap, new_page, paste_screenshot, brand_header, footer, pill, _heart,
)

ROOT = Path(__file__).parent
JOURNEY = ROOT / "docs" / "journey"
OUT = ROOT / "docs" / "ClinIQ_Patient_Journey.pdf"


def step_badge(draw: ImageDraw.ImageDraw, x: int, y: int, n: int, r: int = 30,
               fill=EMERALD, fg=WHITE) -> None:
    draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)
    f = font("bold", int(r * 1.15))
    s = str(n)
    draw.text((x - text_w(draw, s, f) // 2, y - int(r * 0.72)), s, font=f, fill=fg)


# ------------------------------------------------------------------------ cover
def cover() -> "object":
    page = new_page(NAVY)
    draw = ImageDraw.Draw(page)
    # bottom gradient band
    for i in range(300):
        a = i / 300
        col = (int(NAVY[0] + (TEAL[0] - NAVY[0]) * a * 0.55),
               int(NAVY[1] + (TEAL[1] - NAVY[1]) * a * 0.55),
               int(NAVY[2] + (TEAL[2] - NAVY[2]) * a * 0.55))
        draw.line([0, PH - 300 + i, PW, PH - 300 + i], fill=col)

    draw.rounded_rectangle([70, 140, 186, 256], radius=28, fill=TEAL)
    _heart(draw, 128, 194, 28, WHITE)
    draw.text((70, 300), "The Patient", font=font("bold", 116), fill=WHITE)
    draw.text((70, 420), "Journey", font=font("bold", 116), fill=WHITE)
    draw.text((78, 566), "Onboarding → Discharge, one connected record",
              font=font("semibold", 40), fill=(198, 230, 226))

    sub = ("Follow a real patient through every ClinIQ stage — secure login, appointment, "
           "check-in, queue token, triage, doctor consult, lab, pharmacy and digital discharge — "
           "with clinicians approving every step.")
    y = 648
    for ln in wrap(draw, sub, font("regular", 28), PW - 160):
        draw.text((78, y), ln, font=font("regular", 28), fill=(210, 222, 238)); y += 42

    # step chips row
    y = 800; x = 78; fp = font("semibold", 20)
    for label in ["Login", "Book", "Check-in", "Token", "Triage", "Doctor", "Lab", "Pharmacy", "Discharge"]:
        if x + text_w(draw, label, fp) + 40 > PW - 78:
            x = 78; y += 58
        w = text_w(draw, label, fp)
        draw.rounded_rectangle([x, y, x + w + 32, y + 44], radius=22, fill=NAVY_SOFT)
        draw.text((x + 16, y + 11), label, font=fp, fill=WHITE)
        x += w + 32 + 14

    draw.text((78, PH - 150), "Live product walkthrough", font=font("bold", 40), fill=WHITE)
    draw.text((80, PH - 96), "Captured from the running ClinIQ platform · real demo data",
              font=font("regular", 24), fill=(210, 222, 238))
    return page


# ------------------------------------------------------------------- journey map
STAGES = [
    ("01_login", "Secure mobile onboarding & login", "Identity", [
        "Mobile OTP verification — no app install, no passwords.",
        "Time-bound consent captured up front (DPDP-aligned).",
        "Instant, ABHA-ready patient identity.",
    ]),
    ("04_appointment", "Book or confirm an appointment", "Scheduling", [
        "Self-book by symptom and specialty.",
        "Reason for visit captured to guide triage.",
        "Slot confirmation delivered in the portal.",
    ]),
    ("03_checkin", "Queue-free digital check-in", "Arrival", [
        "WhatsApp-style self check-in on arrival.",
        "Auto-verifies identity and active consent.",
        "No paperwork, no reception counter queue.",
    ]),
    ("02_status", "Your live token & queue status", "Token & Queue", [
        "A digital queue token is issued instantly.",
        "Live visit tracker shows the stage in real time.",
        "Status refreshes automatically every few seconds.",
    ]),
    ("05_reception", "Reception & queue desk", "Front Desk", [
        "Live queue and appointment board for staff.",
        "Walk-in registration with voice-to-fill intake.",
        "Token issuance and arrival management.",
    ]),
    ("06_triage", "Nurse triage & ESI acuity", "Triage", [
        "Vitals capture with smart suggestions.",
        "ESI acuity scoring (levels 1–5).",
        "Red-flag detection and doctor routing.",
    ]),
    ("07_doctor", "The doctor's live patient queue", "Doctor Queue", [
        "Priority-ordered by acuity and token.",
        "Red-flag and ESI badges surfaced up front.",
        "One tap to open the consultation.",
    ]),
    ("07b_doctor_consult", "Consultation & AI copilot", "Consultation", [
        "Ambient SOAP note drafting from the conversation.",
        "AI-suggested orders and clinical summaries.",
        "Allergy & vitals context with safe e-prescribing.",
    ]),
    ("08_lab", "Lab diagnostics & results", "Diagnostics", [
        "Orders flow from collection to result.",
        "Automated reference-range result flags.",
        "Patient and doctor notified the moment results post.",
    ]),
    ("09_pharmacy", "Pharmacy & dispensing", "Pharmacy", [
        "Prepaid and walk-in prescription queues.",
        "Live stock levels and pickup tokens.",
        "Allergy and interaction safety checks.",
    ]),
    ("10_discharge", "Billing & digital discharge", "Discharge", [
        "Itemized invoice — consultation plus medicines.",
        "Online payment, zero counter waiting.",
        "Digital discharge summary and records.",
    ]),
]


def journey_map(page_no: int) -> "object":
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, "The Journey")
    draw.text((70, 170), "Eleven stages, one record", font=font("bold", 50), fill=NAVY)
    intro = ("Every stage below is a live screen in the pages that follow — the same encounter "
             "record follows the patient from the first login to digital discharge.")
    y = 258
    for ln in wrap(draw, intro, font("regular", 26), PW - 150):
        draw.text((70, y), ln, font=font("regular", 26), fill=INK); y += 40

    y += 24
    col_w = (PW - 150 - 40) // 2
    ft = font("bold", 26); fs = font("regular", 20)
    for i, (_shot, title, phase, _b) in enumerate(STAGES):
        cx = 70 + (i % 2) * (col_w + 40)
        cy = y + (i // 2) * 176
        draw.rounded_rectangle([cx, cy, cx + col_w, cy + 156], radius=20, fill=LIGHT, outline=LINE, width=2)
        step_badge(draw, cx + 52, cy + 60, i + 1, r=30)
        draw.text((cx + 100, cy + 30), phase, font=fs, fill=EMERALD)
        for j, ln in enumerate(wrap(draw, title, ft, col_w - 120)):
            draw.text((cx + 100, cy + 60 + j * 34), ln, font=ft, fill=NAVY)
    footer(draw, page_no)
    return page


def stage_page(page_no: int, step: int, shot: str, title: str, phase: str, bullets: list[str]) -> "object":
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, f"Step {step} · {phase}")

    left_x = 70
    col_w = 560
    y = 205

    step_badge(draw, left_x + 34, y + 30, step, r=34)
    pill(draw, left_x + 90, y + 8, phase, WHITE, EMERALD, font("semibold", 22))
    y += 96

    for ln in wrap(draw, title, font("bold", 44), col_w):
        draw.text((left_x, y), ln, font=font("bold", 44), fill=NAVY); y += 58
    y += 22

    fb = font("regular", 26)
    for b in bullets:
        draw.ellipse([left_x, y + 10, left_x + 14, y + 24], fill=BLUE)
        for k, ln in enumerate(wrap(draw, b, fb, col_w - 34)):
            draw.text((left_x + 34, y), ln, font=fb, fill=INK); y += 38
        y += 16

    paste_screenshot(page, JOURNEY / f"{shot}.png", cx=940, top=200, target_w=470)
    footer(draw, page_no)
    return page


def main() -> None:
    pages = [cover(), journey_map(2)]
    n = 3
    for i, (shot, title, phase, bullets) in enumerate(STAGES, start=1):
        pages.append(stage_page(n, i, shot, title, phase, bullets))
        n += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=150.0)
    print(f"Wrote {OUT} ({len(pages)} pages)")


if __name__ == "__main__":
    main()
