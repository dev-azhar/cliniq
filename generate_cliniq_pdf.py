"""Generate the ClinIQ product summary PDF with live product screenshots.

Composes a branded cover, an overview page, and one feature page per screen
(feature copy on the left, the live app screenshot on the right).

Run:  backend/.venv/bin/python generate_cliniq_pdf.py
Output: docs/ClinIQ_Product_Summary.pdf
Screenshots are read from docs/screenshots/*.png (captured from the running app).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).parent
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "docs" / "ClinIQ_Product_Summary.pdf"

# A4 portrait @ ~150 DPI
PW, PH = 1240, 1754

# Brand palette
NAVY = (20, 33, 61)
NAVY_SOFT = (33, 49, 82)
BLUE = (37, 100, 207)
TEAL = (13, 148, 136)
EMERALD = (16, 185, 129)
INK = (28, 37, 54)
MUTED = (95, 110, 132)
LIGHT = (243, 247, 252)
LINE = (223, 230, 240)
WHITE = (255, 255, 255)

# ---------------------------------------------------------------- font loading
_FONT_CANDIDATES = {
    "bold": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ],
    "semibold": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ],
    "regular": [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ],
}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    for path in _FONT_CANDIDATES[kind]:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def text_w(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont) -> int:
    return int(draw.textlength(s, font=f))


def wrap(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = s.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if text_w(draw, trial, f) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def new_page(bg=WHITE) -> Image.Image:
    return Image.new("RGB", (PW, PH), bg)


def paste_screenshot(page: Image.Image, path: Path, cx: int, top: int, target_w: int) -> int:
    """Paste a screenshot centered on cx with rounded corners, a border and a soft shadow.
    Returns the pasted height."""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    target_h = int(target_w * h / w)
    img = img.resize((target_w, target_h), Image.LANCZOS)

    radius = 34
    x = cx - target_w // 2

    # Soft drop shadow
    shadow = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [x + 6, top + 14, x + target_w + 6, top + target_h + 14],
        radius=radius, fill=(20, 33, 61, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    page.paste(Image.alpha_composite(page.convert("RGBA"), shadow).convert("RGB"), (0, 0))

    # Rounded mask for the screenshot
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, target_w, target_h], radius=radius, fill=255)
    page.paste(img, (x, top), mask)

    # Border
    ImageDraw.Draw(page).rounded_rectangle(
        [x, top, x + target_w, top + target_h], radius=radius, outline=LINE, width=3
    )
    return target_h


def brand_header(draw: ImageDraw.ImageDraw, section: str) -> None:
    # Small logo tile
    draw.rounded_rectangle([70, 58, 118, 106], radius=14, fill=TEAL)
    _heart(draw, 94, 82, 11, WHITE)
    draw.text((132, 62), "ClinIQ", font=font("bold", 30), fill=NAVY)
    draw.text((133, 100), "Smart Hospital Platform", font=font("regular", 16), fill=MUTED)
    if section:
        f = font("semibold", 20)
        draw.text((PW - 70 - text_w(draw, section, f), 78), section, font=f, fill=BLUE)
    draw.line([70, 128, PW - 70, 128], fill=LINE, width=2)


def footer(draw: ImageDraw.ImageDraw, page_no: int) -> None:
    draw.line([70, PH - 78, PW - 70, PH - 78], fill=LINE, width=2)
    draw.text((70, PH - 62), "ClinIQ — queue-free, AI-assisted, human-approved hospital OS",
              font=font("regular", 16), fill=MUTED)
    s = f"{page_no:02d}"
    draw.text((PW - 70 - text_w(draw, s, font("semibold", 16)), PH - 62), s,
              font=font("semibold", 16), fill=MUTED)


def _heart(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill) -> None:
    draw.ellipse([cx - r, cy - r, cx, cy], fill=fill)
    draw.ellipse([cx, cy - r, cx + r, cy], fill=fill)
    draw.polygon([(cx - r, cy - r // 3), (cx + r, cy - r // 3), (cx, cy + r + 2)], fill=fill)


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, fg, bg,
         f: ImageFont.FreeTypeFont, pad: int = 16) -> int:
    w = text_w(draw, label, f)
    draw.rounded_rectangle([x, y, x + w + pad * 2, y + 44], radius=22, fill=bg)
    draw.text((x + pad, y + 11), label, font=f, fill=fg)
    return x + w + pad * 2


# ------------------------------------------------------------------------ cover
def build_cover() -> Image.Image:
    page = new_page(NAVY)
    draw = ImageDraw.Draw(page)

    # Decorative gradient-ish bands
    for i in range(260):
        a = i / 260
        col = (
            int(NAVY[0] + (TEAL[0] - NAVY[0]) * a * 0.5),
            int(NAVY[1] + (TEAL[1] - NAVY[1]) * a * 0.5),
            int(NAVY[2] + (TEAL[2] - NAVY[2]) * a * 0.5),
        )
        draw.line([0, PH - 260 + i, PW, PH - 260 + i], fill=col)

    # Logo tile
    draw.rounded_rectangle([70, 150, 190, 270], radius=30, fill=TEAL)
    _heart(draw, 130, 205, 30, WHITE)

    draw.text((70, 330), "ClinIQ", font=font("bold", 150), fill=WHITE)
    draw.text((78, 500), "Smart Hospital Platform", font=font("semibold", 52), fill=(198, 230, 226))

    sub = ("An open-source, ABDM-ready hospital operating system that guides every patient "
           "from queue-free check-in to digital discharge — with a clinician-in-the-loop AI mesh.")
    y = 600
    for ln in wrap(draw, sub, font("regular", 30), PW - 160):
        draw.text((78, y), ln, font=font("regular", 30), fill=(210, 222, 238))
        y += 44

    # capability pills
    y = 760
    x = 78
    fpill = font("semibold", 22)
    for label in ["ABDM / ABHA", "FHIR R4", "Clinician-in-the-loop", "DPDP-aligned", "Self-hosted"]:
        if x + text_w(draw, label, fpill) + 40 > PW - 78:
            x = 78
            y += 60
        x = pill(draw, x, y, label, WHITE, (255, 255, 255, 0) if False else NAVY_SOFT, fpill) + 16

    draw.text((78, PH - 150), "Product Summary", font=font("bold", 40), fill=WHITE)
    draw.text((80, PH - 96), "Live product walkthrough · 8 role-based workspaces",
              font=font("regular", 24), fill=(210, 222, 238))
    return page


# --------------------------------------------------------------------- overview
def build_overview(page_no: int) -> Image.Image:
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, "Overview")

    draw.text((70, 170), "What is ClinIQ?", font=font("bold", 52), fill=NAVY)

    intro = ("ClinIQ is a smart hospital platform that transforms the entire patient journey into one "
             "seamless, queue-free experience. Intelligent assistants support triage, clinical notes, "
             "lab insights and prescription safety — while clinicians stay firmly in control and approve "
             "every decision. It runs anywhere, even offline, keeping care uninterrupted; every action is "
             "consent-based and permanently audit-logged for privacy and compliance.")
    y = 260
    for ln in wrap(draw, intro, font("regular", 27), PW - 150):
        draw.text((70, y), ln, font=font("regular", 27), fill=INK)
        y += 42

    y += 30
    draw.text((70, y), "Core capabilities", font=font("bold", 34), fill=NAVY)
    y += 70

    caps = [
        ("AI Triage", "ESI acuity, red-flag detection and smart doctor routing."),
        ("Ambient SOAP", "Offline speech-to-note drafting with speaker diarization."),
        ("Lab Intelligence", "Local PyTorch imaging & pathology, auto result flags."),
        ("Rx Safety (CDS)", "Allergy, interaction and dosing checks at e-prescribing."),
        ("Oncology Care", "TNM staging, chemo cycles, tumor board, survivorship."),
        ("Command Center", "Live ops metrics, stock & compliance, anomaly alerts."),
        ("Consent & Audit", "No PHI read without consent; immutable audit trail."),
        ("Interoperable", "FHIR R4 with LOINC / SNOMED / ICD-10 and ABDM stubs."),
    ]
    col_w = (PW - 150 - 40) // 2
    fx_title = font("bold", 26)
    fx_body = font("regular", 22)
    for i, (title, body) in enumerate(caps):
        cx = 70 + (i % 2) * (col_w + 40)
        cy = y + (i // 2) * 168
        draw.rounded_rectangle([cx, cy, cx + col_w, cy + 148], radius=20, fill=LIGHT, outline=LINE, width=2)
        draw.ellipse([cx + 24, cy + 30, cx + 44, cy + 50], fill=EMERALD)
        draw.text((cx + 62, cy + 26), title, font=fx_title, fill=NAVY)
        ty = cy + 66
        for ln in wrap(draw, body, fx_body, col_w - 90):
            draw.text((cx + 62, ty), ln, font=fx_body, fill=MUTED)
            ty += 32

    footer(draw, page_no)
    return page


# ---------------------------------------------------------------- feature pages
def build_feature(page_no: int, section: str, shot: str, title: str,
                  tag: str, bullets: list[str]) -> Image.Image:
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, section)

    left_x = 70
    col_w = 560
    y = 210

    x_end = pill(draw, left_x, y, tag, WHITE, EMERALD, font("semibold", 22))
    y += 90

    for ln in wrap(draw, title, font("bold", 46), col_w):
        draw.text((left_x, y), ln, font=font("bold", 46), fill=NAVY)
        y += 60
    y += 24

    fb = font("regular", 26)
    for b in bullets:
        draw.ellipse([left_x, y + 10, left_x + 14, y + 24], fill=BLUE)
        bx = left_x + 34
        for i, ln in enumerate(wrap(draw, b, fb, col_w - 34)):
            draw.text((bx, y), ln, font=fb, fill=INK)
            y += 38
        y += 16

    # Screenshot on the right
    paste_screenshot(page, SHOTS / f"{shot}.png", cx=940, top=200, target_w=470)

    footer(draw, page_no)
    return page


FEATURES = [
    ("Platform", "home", "One platform, the whole journey", "Unified OS", [
        "Runs the full outpatient journey — check-in to discharge.",
        "Role-based workspaces for every department.",
        "Live hospital snapshot: patients, wait time, queue.",
        "ABDM / ABHA and FHIR R4 ready out of the box.",
    ]),
    ("Clinician", "doctor", "Doctor Workspace & Copilot", "AI-assisted", [
        "Real-time consult queue with patient context.",
        "Ambient SOAP notes drafted from the conversation.",
        "AI-suggested orders and clinical summaries.",
        "E-prescribing with built-in safety checks.",
    ]),
    ("Oncology", "oncology", "Oncology & Cancer Care", "Specialist", [
        "Diagnosis staging with TNM and ICD-O coding.",
        "Chemotherapy regimens and per-cycle tracking.",
        "Tumor board discussions and recommendations.",
        "Biomarkers and survivorship care plans.",
    ]),
    ("Diagnostics", "lab", "Lab Diagnostics", "Automated", [
        "Order intake and sample-collection workflow.",
        "Automated reference-range result flags.",
        "Local PyTorch imaging & pathology analysis.",
        "Results stream back to the doctor in real time.",
    ]),
    ("Pharmacy", "pharmacy", "Pharmacy & Rx Safety", "Safe by design", [
        "Prescription verification and dispensing.",
        "1000+ medicine catalog with live stock.",
        "Allergy and interaction alerts.",
        "Generic formulation guidance.",
    ]),
    ("Front Desk", "reception", "Reception & Registration", "Fast intake", [
        "Appointments and walk-in registration.",
        "Voice-to-fill patient intake (offline ASR).",
        "Queue tokens and front-desk operations.",
        "Consent captured before any PHI is read.",
    ]),
    ("Operations", "command", "Command Center", "Live ops", [
        "Real-time metrics: patients, wait time, queue.",
        "Queue load by department at a glance.",
        "Stock and compliance alerts.",
        "Immutable, DPDP-aligned audit trail.",
    ]),
    ("Administration", "admin", "Admin & Configuration", "Control", [
        "Manage staff, departments and specialties.",
        "Configure operating hours and slots.",
        "Lab slot timetables and rosters.",
        "Platform-wide settings and directory.",
    ]),
]


def main() -> None:
    pages = [build_cover(), build_overview(2)]
    n = 3
    for section, shot, title, tag, bullets in FEATURES:
        pages.append(build_feature(n, section, shot, title, tag, bullets))
        n += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=150.0)
    print(f"Wrote {OUT} ({len(pages)} pages)")


if __name__ == "__main__":
    main()
