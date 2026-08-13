"""Generate a ClinIQ PDF pairing the PATIENT dashboard with the DOCTOR dashboard
for the SAME live patient activity.

Story: Shaikh Azhar checks in / books from the patient portal (token A-063),
and that activity streams straight into Dr. Vikram Rao's live doctor workspace
— same token, same reason, same vitals.

Run:  backend/.venv/bin/python generate_cliniq_activity_pdf.py
Output: docs/ClinIQ_Patient_Doctor_Activity.pdf
Screenshots are read from docs/activity/*.png (captured from the running app).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from generate_cliniq_pdf import (
    BLUE, EMERALD, INK, LIGHT, LINE, MUTED, NAVY, NAVY_SOFT, TEAL, WHITE,
    PH, PW, _heart, brand_header, font, footer, new_page, pill, text_w, wrap,
)

ROOT = Path(__file__).parent
SHOTS = ROOT / "docs" / "activity"
OUT = ROOT / "docs" / "ClinIQ_Patient_Doctor_Activity.pdf"


# ------------------------------------------------------------- image utilities
def trim_bottom(img: Image.Image) -> Image.Image:
    """Drop trailing near-uniform (background) rows so screenshots sit flush."""
    gray = img.convert("L")
    w, h = img.size
    px = gray.load()
    bg = px[2, 2]
    tol = 8

    def blank(y: int) -> bool:
        return all(abs(px[x, y] - bg) <= tol for x in range(0, w, 7))

    last = h - 1
    while last > 10 and blank(last):
        last -= 1
    return img.crop((0, 0, w, min(h, last + 18)))


def paste_fit(page: Image.Image, path: Path, box_x: int, box_y: int,
              box_w: int, box_h: int, radius: int = 30) -> tuple[int, int, int, int]:
    """Scale a screenshot to the column width, crop the bottom if it is taller
    than box_h (top-aligned), and paste it with rounded corners + border + shadow.
    Returns the drawn rectangle (x, y, w, h)."""
    img = trim_bottom(Image.open(path).convert("RGB"))
    w, h = img.size
    scale = box_w / w
    new_w = box_w
    new_h = int(h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    if new_h > box_h:
        img = img.crop((0, 0, new_w, box_h))
        new_h = box_h
    x = box_x + (box_w - new_w) // 2
    y = box_y

    # Soft drop shadow
    shadow = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([x + 6, y + 14, x + new_w + 6, y + new_h + 14],
                         radius=radius, fill=(20, 33, 61, 65))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    page.paste(Image.alpha_composite(page.convert("RGBA"), shadow).convert("RGB"), (0, 0))

    mask = Image.new("L", (new_w, new_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, new_w, new_h], radius=radius, fill=255)
    page.paste(img, (x, y), mask)
    ImageDraw.Draw(page).rounded_rectangle(
        [x, y, x + new_w, y + new_h], radius=radius, outline=LINE, width=3)
    return x, y, new_w, new_h


# ------------------------------------------------------------------------ cover
def build_cover() -> Image.Image:
    page = new_page(NAVY)
    draw = ImageDraw.Draw(page)

    for i in range(300):
        a = i / 300
        col = (
            int(NAVY[0] + (TEAL[0] - NAVY[0]) * a * 0.55),
            int(NAVY[1] + (TEAL[1] - NAVY[1]) * a * 0.55),
            int(NAVY[2] + (TEAL[2] - NAVY[2]) * a * 0.55),
        )
        draw.line([0, PH - 300 + i, PW, PH - 300 + i], fill=col)

    draw.rounded_rectangle([70, 150, 190, 270], radius=30, fill=TEAL)
    _heart(draw, 130, 205, 30, WHITE)

    draw.text((70, 320), "ClinIQ", font=font("bold", 128), fill=WHITE)
    draw.text((78, 470), "Patient activity, live on the", font=font("semibold", 46), fill=(198, 230, 226))
    draw.text((78, 528), "doctor's dashboard", font=font("semibold", 46), fill=(198, 230, 226))

    sub = ("One patient does something on the phone — checks in, books a slot, updates a reason — "
           "and the doctor's workspace reacts in real time. Same token, same reason, same vitals, "
           "no manual re-entry.")
    y = 620
    for ln in wrap(draw, sub, font("regular", 29), PW - 160):
        draw.text((78, y), ln, font=font("regular", 29), fill=(210, 222, 238))
        y += 43

    y = 800
    x = 78
    fpill = font("semibold", 22)
    for label in ["Patient Portal", "Doctor Workspace", "Live queue", "Real-time sync"]:
        if x + text_w(draw, label, fpill) + 40 > PW - 78:
            x = 78
            y += 60
        x = pill(draw, x, y, label, WHITE, NAVY_SOFT, fpill) + 16

    draw.text((78, PH - 150), "Two-Sided Walkthrough", font=font("bold", 40), fill=WHITE)
    draw.text((80, PH - 96), "Live product screenshots · patient ↔ doctor",
              font=font("regular", 24), fill=(210, 222, 238))
    return page


# --------------------------------------------------------------------- overview
def build_overview(page_no: int) -> Image.Image:
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, "How it connects")

    draw.text((70, 170), "One patient, two synchronized views",
              font=font("bold", 46), fill=NAVY)

    intro = ("Everything a patient does in the ClinIQ portal is an event the clinical team sees "
             "instantly. When Shaikh Azhar checks in and is issued token A-063, he shows up in "
             "Dr. Vikram Rao's live queue — with his acuity, chief complaint and wait time already "
             "attached. Opening his card loads the full Patient 360, so the doctor starts the consult "
             "with context, not a blank page.")
    y = 262
    for ln in wrap(draw, intro, font("regular", 27), PW - 150):
        draw.text((70, y), ln, font=font("regular", 27), fill=INK)
        y += 42

    y += 34
    draw.text((70, y), "The flow", font=font("bold", 34), fill=NAVY)
    y += 78

    steps = [
        ("1", "Patient acts", "Check-in, booking or a reason update from the patient portal."),
        ("2", "Queue updates", "A token is issued and the visit streams into the doctor's live queue."),
        ("3", "Doctor consults", "One click opens Patient 360 — vitals, history, orders, e-prescribing."),
    ]
    card_w = (PW - 150 - 2 * 34) // 3
    for i, (num, title, body) in enumerate(steps):
        cx = 70 + i * (card_w + 34)
        draw.rounded_rectangle([cx, y, cx + card_w, y + 250], radius=22,
                               fill=LIGHT, outline=LINE, width=2)
        draw.ellipse([cx + 28, y + 28, cx + 74, y + 74], fill=TEAL)
        draw.text((cx + 44, y + 36), num, font=font("bold", 30), fill=WHITE)
        draw.text((cx + 28, y + 96), title, font=font("bold", 27), fill=NAVY)
        ty = y + 140
        for ln in wrap(draw, body, font("regular", 21), card_w - 56):
            draw.text((cx + 28, ty), ln, font=font("regular", 21), fill=MUTED)
            ty += 30
        if i < 2:
            draw.text((cx + card_w + 4, y + 108), "→", font=font("bold", 40), fill=BLUE)

    y += 250 + 60
    draw.rounded_rectangle([70, y, PW - 70, y + 150], radius=22, fill=(240, 249, 246),
                           outline=(191, 227, 217), width=2)
    draw.text((100, y + 26), "In this walkthrough", font=font("bold", 26), fill=TEAL)
    line2 = ("Patient dashboard · Doctor live queue · Patient 360 consult · Self-service booking — "
             "all captured from the running app for the same patient, Shaikh Azhar (A-063).")
    ty = y + 70
    for ln in wrap(draw, line2, font("regular", 23), PW - 200):
        draw.text((100, ty), ln, font=font("regular", 23), fill=INK)
        ty += 32

    footer(draw, page_no)
    return page


# ------------------------------------------------------------------ split hero
def build_split(page_no: int) -> Image.Image:
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, "Side by side")

    draw.text((70, 168), "The same visit, on both screens", font=font("bold", 44), fill=NAVY)

    # Caption strip
    draw.rounded_rectangle([70, 246, PW - 70, 300], radius=16, fill=NAVY)
    cap = "Shaikh Azhar   ·   Token A-063   ·   Follow-up review for hypertension"
    draw.text((PW // 2 - text_w(draw, cap, font("semibold", 24)) // 2, 258),
              cap, font=font("semibold", 24), fill=WHITE)

    col_w = 500
    gap = 40
    left_x = (PW - (col_w * 2 + gap)) // 2
    right_x = left_x + col_w + gap
    top = 400
    box_h = 1160

    draw.text((left_x, 340), "PATIENT PORTAL", font=font("bold", 22), fill=TEAL)
    draw.text((right_x, 340), "DOCTOR WORKSPACE", font=font("bold", 22), fill=BLUE)

    paste_fit(page, SHOTS / "01_patient_dashboard.png", left_x, top, col_w, box_h)
    paste_fit(page, SHOTS / "03_doctor_consult.png", right_x, top, col_w, box_h)

    footer(draw, page_no)
    return page


# ---------------------------------------------------------------- feature page
def build_feature(page_no: int, section: str, shot: str, title: str,
                  tag: str, bullets: list[str]) -> Image.Image:
    page = new_page(WHITE)
    draw = ImageDraw.Draw(page)
    brand_header(draw, section)

    left_x = 70
    col_w = 560
    y = 210

    pill(draw, left_x, y, tag, WHITE, EMERALD, font("semibold", 22))
    y += 92

    for ln in wrap(draw, title, font("bold", 44), col_w):
        draw.text((left_x, y), ln, font=font("bold", 44), fill=NAVY)
        y += 58
    y += 26

    fb = font("regular", 26)
    for b in bullets:
        draw.ellipse([left_x, y + 10, left_x + 14, y + 24], fill=BLUE)
        bx = left_x + 34
        for ln in wrap(draw, b, fb, col_w - 34):
            draw.text((bx, y), ln, font=fb, fill=INK)
            y += 38
        y += 16

    paste_fit(page, SHOTS / f"{shot}.png", box_x=690, box_y=200, box_w=480, box_h=1360)

    footer(draw, page_no)
    return page


FEATURES = [
    ("Patient Portal", "01_patient_dashboard", "The patient's live visit dashboard",
     "Self-service", [
         "Shaikh checks in from his phone — no paperwork, no counter queue.",
         "A queue token (A-063) is issued instantly with live position and wait time.",
         "The visit tracker shows every step from check-in to discharge.",
         "His reason — 'Follow-up review for hypertension' — is captured up front.",
     ]),
    ("Doctor Workspace", "02_doctor_queue", "The same activity, on the doctor's queue",
     "Live queue", [
         "Dr. Vikram Rao's queue updates in real time as patients check in.",
         "ESI acuity and red-flag alerts float the sickest patients to the top.",
         "Each card carries token, age/sex, chief complaint, room and est. wait.",
         "Shaikh Azhar (A-063) appears automatically — nothing re-typed.",
     ]),
    ("Doctor Workspace", "03_doctor_consult", "One click into the full Patient 360",
     "Patient 360", [
         "Opening Shaikh's card loads his record in the consult view.",
         "Latest vitals, chronic problems, medications and reports in one place.",
         "Ambient SOAP, orders, labs and e-prescribing sit a tab away.",
         "The reason he entered on the portal flows straight into the note.",
     ]),
    ("Patient Portal", "04_patient_booking", "Patients book their own slots",
     "Booking", [
         "Symptoms are mapped to the right specialty automatically.",
         "Real doctor availability is shown by day and time.",
         "If today's slots have passed, ClinIQ rolls to the next open day.",
         "A tap picks a slot and moves straight to secure payment.",
     ]),
]


def main() -> None:
    pages = [build_cover(), build_overview(2), build_split(3)]
    n = 4
    for section, shot, title, tag, bullets in FEATURES:
        pages.append(build_feature(n, section, shot, title, tag, bullets))
        n += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=150.0)
    print(f"Wrote {OUT} ({len(pages)} pages)")


if __name__ == "__main__":
    main()
