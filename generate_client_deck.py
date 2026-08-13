"""Generate the one-page ClinIQ client overview.

The deck uses only Python's standard library and PDF built-in fonts.
Run: python3 generate_client_deck.py
Output: docs/ClinIQ_Client_One_Page.pdf
"""

from pathlib import Path


PAGE_W = 960
PAGE_H = 540
OUTPUT_PATH = Path(__file__).parent / "docs" / "ClinIQ_Client_One_Page.pdf"

INK = (0.078, 0.137, 0.129)
NAVY = (0.055, 0.180, 0.204)
TEAL = (0.031, 0.498, 0.451)
MINT = (0.863, 0.937, 0.914)
CORAL = (0.910, 0.365, 0.290)
GOLD = (0.871, 0.651, 0.227)
PAPER = (0.969, 0.961, 0.929)
WHITE = (1.0, 0.996, 0.980)
MUTED = (0.361, 0.412, 0.396)
LINE = (0.796, 0.847, 0.824)


def pdf_string(value):
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def rgb(color):
    return " ".join(f"{component:.3f}" for component in color)


def text_width(value, size, bold=False):
    total = 0.0
    for character in value:
        if character in " ilI.,'|!":
            factor = 0.25
        elif character in "mwMW@%":
            factor = 0.82
        elif character.isupper():
            factor = 0.61
        else:
            factor = 0.50
        total += factor
    return total * size * (1.04 if bold else 1.0)


def wrap_text(value, width, size, bold=False):
    words = value.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if not current or text_width(candidate, size, bold) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


class PDF:
    def __init__(self):
        self.objects = []
        self.next_id = 1

    def allocate(self):
        object_id = self.next_id
        self.next_id += 1
        return object_id

    def add(self, content):
        object_id = self.allocate()
        raw = content if isinstance(content, bytes) else content.encode("latin-1")
        self.objects.append((object_id, raw))
        return object_id

    def add_at(self, object_id, content):
        raw = content if isinstance(content, bytes) else content.encode("latin-1")
        self.objects.append((object_id, raw))

    def write(self, output_path, root_id):
        body = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        offsets = {}
        for object_id, raw in sorted(self.objects):
            offsets[object_id] = len(body)
            body += f"{object_id} 0 obj\n".encode("ascii")
            body += raw + b"\nendobj\n"

        object_count = max(offsets) + 1
        xref_offset = len(body)
        xref = f"xref\n0 {object_count}\n0000000000 65535 f \n"
        for object_id in range(1, object_count):
            xref += f"{offsets[object_id]:010d} 00000 n \n"
        trailer = (
            f"trailer\n<< /Size {object_count} /Root {root_id} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(body + (xref + trailer).encode("ascii"))


class Canvas:
    def __init__(self):
        self.commands = []

    def rect(self, x, y, width, height, fill, stroke=None, line_width=1):
        self.commands.append(f"{rgb(fill)} rg")
        if stroke:
            self.commands.append(f"{rgb(stroke)} RG {line_width:.2f} w")
            operator = "B"
        else:
            operator = "f"
        self.commands.append(f"{x:.2f} {y:.2f} {width:.2f} {height:.2f} re {operator}")

    def rounded_rect(self, x, y, width, height, radius, fill, stroke=None, line_width=1):
        radius = min(radius, width / 2, height / 2)
        kappa = radius * 0.55228475
        self.commands.append(f"{rgb(fill)} rg")
        if stroke:
            self.commands.append(f"{rgb(stroke)} RG {line_width:.2f} w")
            operator = "B"
        else:
            operator = "f"
        path = [
            f"{x + radius:.2f} {y:.2f} m",
            f"{x + width - radius:.2f} {y:.2f} l",
            f"{x + width - radius + kappa:.2f} {y:.2f} {x + width:.2f} {y + radius - kappa:.2f} {x + width:.2f} {y + radius:.2f} c",
            f"{x + width:.2f} {y + height - radius:.2f} l",
            f"{x + width:.2f} {y + height - radius + kappa:.2f} {x + width - radius + kappa:.2f} {y + height:.2f} {x + width - radius:.2f} {y + height:.2f} c",
            f"{x + radius:.2f} {y + height:.2f} l",
            f"{x + radius - kappa:.2f} {y + height:.2f} {x:.2f} {y + height - radius + kappa:.2f} {x:.2f} {y + height - radius:.2f} c",
            f"{x:.2f} {y + radius:.2f} l",
            f"{x:.2f} {y + radius - kappa:.2f} {x + radius - kappa:.2f} {y:.2f} {x + radius:.2f} {y:.2f} c",
            operator,
        ]
        self.commands.extend(path)

    def circle(self, center_x, center_y, radius, fill, stroke=None, line_width=1):
        kappa = radius * 0.55228475
        self.commands.append(f"{rgb(fill)} rg")
        if stroke:
            self.commands.append(f"{rgb(stroke)} RG {line_width:.2f} w")
            operator = "B"
        else:
            operator = "f"
        self.commands.extend([
            f"{center_x + radius:.2f} {center_y:.2f} m",
            f"{center_x + radius:.2f} {center_y + kappa:.2f} {center_x + kappa:.2f} {center_y + radius:.2f} {center_x:.2f} {center_y + radius:.2f} c",
            f"{center_x - kappa:.2f} {center_y + radius:.2f} {center_x - radius:.2f} {center_y + kappa:.2f} {center_x - radius:.2f} {center_y:.2f} c",
            f"{center_x - radius:.2f} {center_y - kappa:.2f} {center_x - kappa:.2f} {center_y - radius:.2f} {center_x:.2f} {center_y - radius:.2f} c",
            f"{center_x + kappa:.2f} {center_y - radius:.2f} {center_x + radius:.2f} {center_y - kappa:.2f} {center_x + radius:.2f} {center_y:.2f} c",
            operator,
        ])

    def line(self, x1, y1, x2, y2, color, line_width=1):
        self.commands.append(
            f"{rgb(color)} RG {line_width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"
        )

    def triangle(self, points, fill):
        commands = [f"{rgb(fill)} rg", f"{points[0][0]:.2f} {points[0][1]:.2f} m"]
        for x, y in points[1:]:
            commands.append(f"{x:.2f} {y:.2f} l")
        commands.append("h f")
        self.commands.extend(commands)

    def text(self, x, y, value, font="H", size=10, color=INK):
        self.commands.append(
            "BT "
            f"/{font} {size:.2f} Tf {rgb(color)} rg "
            f"1 0 0 1 {x:.2f} {y:.2f} Tm "
            f"({pdf_string(value)}) Tj ET"
        )

    def paragraph(self, x, top_y, value, width, font="H", size=10, leading=None, color=INK, max_lines=None):
        bold = font == "HB"
        lines = wrap_text(value, width, size, bold)
        if max_lines is not None:
            lines = lines[:max_lines]
        leading = leading or size * 1.3
        for index, line in enumerate(lines):
            self.text(x, top_y - index * leading, line, font, size, color)
        return top_y - len(lines) * leading

    def stream(self):
        return "\n".join(self.commands)


def add_arrow(canvas, start_x, end_x, y):
    canvas.line(start_x, y, end_x - 4, y, TEAL, 1.4)
    canvas.triangle(((end_x - 4, y + 3), (end_x, y), (end_x - 4, y - 3)), TEAL)


def add_flow_card(canvas, index, x, title, detail, fill):
    y = 247
    width = 114
    height = 64
    canvas.rounded_rect(x, y, width, height, 5, fill, LINE, 0.8)
    badge_color = CORAL if index in (1, 3, 7) else TEAL
    canvas.circle(x + 16, y + height - 16, 9, badge_color)
    number = f"{index:02d}"
    number_x = x + 16 - text_width(number, 7, True) / 2
    canvas.text(number_x, y + height - 18.5, number, "HB", 7, WHITE)
    canvas.text(x + 30, y + height - 18.5, title, "HB", 7.5, NAVY)
    canvas.paragraph(x + 12, y + 25, detail, width - 24, "H", 7.7, 10, MUTED, 2)


def add_value_card(canvas, x, title, body, statement, accent):
    y = 78
    width = 278
    height = 125
    canvas.rounded_rect(x, y, width, height, 6, WHITE, LINE, 0.9)
    canvas.rect(x, y, 5, height, accent)
    canvas.text(x + 18, y + height - 23, title, "HB", 8.3, accent)
    canvas.paragraph(x + 18, y + height - 45, body, width - 36, "H", 9, 12, INK, 4)
    canvas.rounded_rect(x + 18, y + 13, width - 36, 25, 4, MINT)
    canvas.text(x + 28, y + 22, statement, "HB", 8.1, NAVY)


def center_text(canvas, cx, y, value, font, size, color):
    canvas.text(cx - text_width(value, size, font == "HB") / 2, y, value, font, size, color)


def draw_header(canvas, tag_bold, tag_muted):
    canvas.rounded_rect(38, 494, 28, 28, 6, TEAL)
    canvas.text(45.5, 502.5, "Q", "HB", 13, WHITE)
    canvas.text(76, 506, "ClinIQ", "HB", 16, NAVY)
    canvas.text(76, 493.5, "CONNECTED CARE OPERATIONS", "HB", 6.7, TEAL)
    muted_w = text_width(tag_muted, 7.2)
    canvas.text(922 - muted_w, 505, tag_muted, "H", 7.2, MUTED)
    bold_w = text_width(tag_bold, 7.2, True)
    canvas.text(922 - muted_w - 14 - bold_w, 505, tag_bold, "HB", 7.2, NAVY)


# --- SVG-style vector glyphs: a white icon drawn on an accent badge ---------

def glyph_doc(canvas, cx, cy, accent):
    canvas.rounded_rect(cx - 5.5, cy - 7, 11, 14, 1.5, WHITE)
    for index, line_y in enumerate((cy + 3.5, cy + 0.5, cy - 2.5)):
        width = 7 if index < 2 else 4.5
        canvas.line(cx - 3.5, line_y, cx - 3.5 + width, line_y, accent, 1.1)


def glyph_pulse(canvas, cx, cy, accent):
    points = [
        (cx - 9, cy), (cx - 4, cy), (cx - 1.5, cy + 6.5), (cx + 1.5, cy - 7.5),
        (cx + 4, cy + 1.5), (cx + 6, cy), (cx + 9, cy),
    ]
    for start, end in zip(points, points[1:]):
        canvas.line(start[0], start[1], end[0], end[1], WHITE, 1.5)


def glyph_cross(canvas, cx, cy, accent):
    canvas.rect(cx - 2, cy - 7.5, 4, 15, WHITE)
    canvas.rect(cx - 7.5, cy - 2, 15, 4, WHITE)


def glyph_flask(canvas, cx, cy, accent):
    canvas.rect(cx - 1.6, cy + 1, 3.2, 6.5, WHITE)
    canvas.triangle(((cx - 2, cy + 1), (cx + 2, cy + 1), (cx + 6.5, cy - 7.5), (cx - 6.5, cy - 7.5)), WHITE)


def glyph_rx(canvas, cx, cy, accent):
    center_text(canvas, cx, cy - 4.5, "Rx", "HB", 13, WHITE)


def glyph_rupee(canvas, cx, cy, accent):
    center_text(canvas, cx, cy - 4.5, "Rs", "HB", 12, WHITE)


def glyph_rings(canvas, cx, cy, accent):
    canvas.circle(cx, cy, 7.5, accent, WHITE, 1.5)
    canvas.circle(cx, cy, 3.6, accent, WHITE, 1.5)
    canvas.circle(cx, cy, 1.3, WHITE)


def glyph_grid(canvas, cx, cy, accent):
    canvas.rounded_rect(cx - 6.2, cy + 0.8, 5.4, 5.4, 1, WHITE)
    canvas.rounded_rect(cx + 0.8, cy + 0.8, 5.4, 5.4, 1, WHITE)
    canvas.rounded_rect(cx - 6.2, cy - 6.2, 5.4, 5.4, 1, WHITE)
    canvas.rounded_rect(cx + 0.8, cy - 6.2, 5.4, 5.4, 1, WHITE)


def glyph_wave(canvas, cx, cy, accent):
    heights = (6, 11, 16, 9, 14, 7)
    for index, height in enumerate(heights):
        bar_x = cx - 11.5 + index * 4.4
        canvas.rect(bar_x, cy - height / 2, 2.4, height, WHITE)


def glyph_capsule(canvas, cx, cy, accent):
    canvas.rounded_rect(cx - 8.5, cy - 3.6, 17, 7.2, 3.6, WHITE)
    canvas.rect(cx - 0.7, cy - 3.6, 1.4, 7.2, accent)


def glyph_scan(canvas, cx, cy, accent):
    canvas.rounded_rect(cx - 8, cy - 7, 16, 14, 2, WHITE)
    canvas.line(cx, cy - 4.6, cx, cy + 4.6, accent, 1.2)
    canvas.line(cx - 5, cy, cx + 5, cy, accent, 1.2)


def glyph_mic(canvas, cx, cy, accent):
    canvas.rounded_rect(cx - 3.4, cy - 1, 6.8, 11, 3.4, WHITE)
    canvas.line(cx - 6, cy - 1, cx - 6, cy - 4.5, WHITE, 1.4)
    canvas.line(cx + 6, cy - 1, cx + 6, cy - 4.5, WHITE, 1.4)
    canvas.line(cx - 6, cy - 4.5, cx + 6, cy - 4.5, WHITE, 1.4)
    canvas.line(cx, cy - 4.5, cx, cy - 8.5, WHITE, 1.4)
    canvas.line(cx - 4, cy - 8.5, cx + 4, cy - 8.5, WHITE, 1.4)


def add_module_card(canvas, x, y, width, height, glyph, accent, title, detail):
    canvas.rounded_rect(x, y, width, height, 6, WHITE, LINE, 0.9)
    badge_x = x + 27
    badge_y = y + height / 2
    canvas.rounded_rect(badge_x - 15, badge_y - 15, 30, 30, 7, accent)
    glyph(canvas, badge_x, badge_y, accent)
    canvas.text(x + 54, y + height / 2 + 4.5, title, "HB", 8.8, NAVY)
    canvas.paragraph(x + 54, y + height / 2 - 7.5, detail, width - 64, "H", 7.4, 9, MUTED, 2)


def add_ai_card(canvas, x, y, width, height, glyph, accent, title, detail):
    canvas.rounded_rect(x, y, width, height, 6, WHITE, LINE, 0.9)
    badge_x = x + 24
    badge_y = y + height - 22
    canvas.rounded_rect(badge_x - 13, badge_y - 13, 26, 26, 7, accent)
    glyph(canvas, badge_x, badge_y, accent)
    canvas.text(x + 46, y + height - 25, title, "HB", 8.3, NAVY)
    canvas.paragraph(x + 18, y + height - 42, detail, width - 34, "H", 7.5, 9.4, MUTED, 3)


def draw_page_one(canvas):
    canvas.rect(0, 0, PAGE_W, PAGE_H, PAPER)
    canvas.rect(0, PAGE_H - 7, PAGE_W, 7, TEAL)

    draw_header(canvas, "CLIENT OVERVIEW", "OPERATIONAL PROTOTYPE")

    canvas.text(38, 454, "One connected journey.", "HB", 31, NAVY)
    canvas.text(38, 417, "Every role in sync.", "HB", 31, CORAL)
    canvas.paragraph(
        40,
        386,
        "ClinIQ coordinates outpatient care from arrival to follow-up through one shared encounter, role-specific workspaces and assistive AI.",
        520,
        "H",
        11,
        14,
        INK,
        3,
    )
    canvas.rounded_rect(40, 341, 253, 23, 11, MINT)
    canvas.text(54, 349, "Local workflow verified  |  Built for a measured pilot", "HB", 8.2, TEAL)

    canvas.rounded_rect(620, 354, 302, 105, 8, NAVY)
    canvas.text(642, 434, "THE PLATFORM PROMISE", "HB", 7.2, GOLD)
    canvas.text(642, 405, "Coordinate care,", "HB", 18, WHITE)
    canvas.text(642, 383, "not screens.", "HB", 18, WHITE)
    canvas.paragraph(
        788,
        410,
        "Shared context connects patient flow, clinical work and status visibility while care teams retain every decision.",
        112,
        "H",
        8,
        11,
        WHITE,
        5,
    )

    canvas.text(38, 323, "THE CONNECTED PATIENT JOURNEY", "HB", 7.4, TEAL)
    canvas.line(247, 326, 922, 326, LINE, 0.8)

    flow = (
        ("RECEPTION", "Register + check-in"),
        ("TRIAGE", "Vitals + acuity"),
        ("DOCTOR", "Patient 360 + notes"),
        ("LAB", "Orders + results"),
        ("PHARMACY", "Rx + dispense"),
        ("BILLING", "Invoice + payment"),
        ("PATIENT", "Status + follow-up"),
    )
    start_x = 38
    card_width = 114
    gap = 15
    for index, (title, detail) in enumerate(flow, start=1):
        x = start_x + (index - 1) * (card_width + gap)
        fill = WHITE if index % 2 else MINT
        add_flow_card(canvas, index, x, title, detail, fill)
        if index < len(flow):
            add_arrow(canvas, x + card_width + 2, x + card_width + gap - 2, 279)

    canvas.rounded_rect(184, 218, 592, 18, 9, NAVY)
    canvas.text(
        230,
        224,
        "ONE SHARED ENCOUNTER  |  LIVE STATUS  |  ROLE-BASED ACCESS  |  AUDITABLE ACTIONS",
        "HB",
        7.3,
        WHITE,
    )

    add_value_card(
        canvas,
        38,
        "ROLE-BASED OPERATIONS",
        "Reception, triage, doctor, lab, pharmacy, oncology and command views work from the same patient journey.",
        "Less re-entry. Clearer handoffs.",
        TEAL,
    )
    add_value_card(
        canvas,
        341,
        "GUARDED AI ASSISTANCE",
        "Draft SOAP notes, medication checks and selected diagnostic review support staff. A clinician validates every output.",
        "AI proposes. People decide.",
        CORAL,
    )
    add_value_card(
        canvas,
        644,
        "PILOT, MEASURE, SCALE",
        "Start with one OPD pathway, establish a baseline, configure the workflow and evaluate with hospital teams.",
        "Measure wait, handoffs, time and adoption.",
        GOLD,
    )

    canvas.rounded_rect(38, 18, 884, 43, 6, NAVY)
    canvas.text(54, 43, "PROPOSED NEXT STEP", "HB", 7.2, GOLD)
    canvas.text(168, 40.5, "A controlled OPD pilot", "HB", 12.5, WHITE)
    canvas.text(370, 41.5, "Baseline  >  Configure  >  Evaluate", "HB", 8.2, MINT)
    canvas.text(
        54,
        26,
        "Enterprise scale, live payments, ABDM/FHIR integration and regulatory validation remain deployment workstreams.",
        "H",
        7.1,
        WHITE,
    )


def draw_page_two(canvas):
    canvas.rect(0, 0, PAGE_W, PAGE_H, PAPER)
    canvas.rect(0, PAGE_H - 7, PAGE_W, 7, TEAL)

    draw_header(canvas, "INSIDE THE PLATFORM", "PAGE 2 OF 2")

    canvas.text(38, 470, "WHAT'S INSIDE THE PLATFORM", "HB", 7.4, TEAL)
    canvas.text(38, 447, "Built for every role.", "HB", 25, NAVY)
    canvas.text(38, 420, "Deep where it counts.", "HB", 25, CORAL)
    canvas.paragraph(
        40,
        400,
        "Each team works in a purpose-built space on one shared patient record, with assistive AI that stays under clinician control.",
        884,
        "H",
        9.2,
        12.5,
        INK,
        2,
    )

    # Role-based workspaces
    canvas.text(38, 384, "ROLE-BASED WORKSPACES", "HB", 7.4, TEAL)
    canvas.line(212, 387, 922, 387, LINE, 0.8)

    modules = (
        (glyph_doc, TEAL, "Reception", "Register, check-in and walk-in intake"),
        (glyph_pulse, CORAL, "Triage", "Vitals capture and acuity scoring"),
        (glyph_cross, TEAL, "Doctor", "Patient 360, notes and orders"),
        (glyph_flask, CORAL, "Lab", "Test orders, results and imaging"),
        (glyph_rx, TEAL, "Pharmacy", "Drug catalog, prescribe and dispense"),
        (glyph_rupee, CORAL, "Billing", "Invoices, payment and discharge"),
        (glyph_rings, TEAL, "Oncology", "Staging, chemo and tumor board"),
        (glyph_grid, CORAL, "Command", "Live queues and operations view"),
    )
    card_width = 210
    card_gap = 14.4
    module_height = 60
    for index, (glyph, accent, title, detail) in enumerate(modules):
        column = index % 4
        row = index // 4
        x = 38 + column * (card_width + card_gap)
        y = 314 - row * (module_height + 8)
        add_module_card(canvas, x, y, card_width, module_height, glyph, accent, title, detail)

    # Assistive AI
    canvas.text(38, 232, "ASSISTIVE AI, UNDER CLINICIAN CONTROL", "HB", 7.4, CORAL)
    note = "AI proposes. A clinician approves every output."
    canvas.text(922 - text_width(note, 7.2), 232, note, "HI", 7.2, MUTED)

    ai_cards = (
        (glyph_wave, TEAL, "Ambient notes", "Offline voice dictation drafts SOAP notes for review"),
        (glyph_capsule, CORAL, "Formulary help", "Generic and interaction guidance on prescriptions"),
        (glyph_scan, GOLD, "Imaging review", "On-device X-ray and CT / DICOM analysis"),
        (glyph_mic, TEAL, "Voice intake", "Speak to fill new-patient registration"),
    )
    ai_height = 62
    for index, (glyph, accent, title, detail) in enumerate(ai_cards):
        x = 38 + index * (card_width + card_gap)
        add_ai_card(canvas, x, 156, card_width, ai_height, glyph, accent, title, detail)

    # Foundations + honest scope band
    canvas.rounded_rect(38, 18, 884, 122, 8, NAVY)
    canvas.text(58, 116, "PLATFORM FOUNDATIONS", "HB", 7, GOLD)
    chips = (
        "Real-time status",
        "Role-based access",
        "Audit trail on actions",
        "Consent + OTP verification",
        "Local / offline AI",
    )
    chip_x = 58
    for label in chips:
        chip_w = text_width(label, 7.2, True) + 20
        canvas.rounded_rect(chip_x, 92, chip_w, 17, 8, MINT)
        canvas.text(chip_x + 10, 97.5, label, "HB", 7.2, NAVY)
        chip_x += chip_w + 12
    canvas.line(58, 80, 902, 80, TEAL, 0.6)
    canvas.text(58, 62, "SCOPE TODAY", "HB", 7, GOLD)
    canvas.text(150, 60, "An operational prototype, verified in local workflow.", "HB", 10.5, WHITE)
    pill = "READY FOR A CONTROLLED OPD PILOT"
    pill_w = text_width(pill, 7, True) + 22
    canvas.rounded_rect(902 - pill_w, 55, pill_w, 18, 9, TEAL)
    canvas.text(902 - pill_w + 11, 60.5, pill, "HB", 7, WHITE)
    canvas.paragraph(
        58,
        41,
        "Enterprise scale, live payments, ABDM / ABHA / FHIR interoperability and regulatory validation remain planned deployment workstreams.",
        844,
        "H",
        7.4,
        10,
        MINT,
        2,
    )


def build_deck(output_path=OUTPUT_PATH):
    pdf = PDF()
    pages_id = pdf.allocate()

    font_normal = pdf.add(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )
    font_bold = pdf.add(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    )
    font_oblique = pdf.add(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
    )

    page_ids = []
    for draw in (draw_page_one, draw_page_two):
        canvas = Canvas()
        draw(canvas)
        stream_bytes = canvas.stream().encode("latin-1")
        stream_id = pdf.add(
            f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
            + stream_bytes
            + b"\nendstream"
        )
        page_id = pdf.add(
            f"<< /Type /Page /Parent {pages_id} 0 R "
            f"/MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /H {font_normal} 0 R /HB {font_bold} 0 R /HI {font_oblique} 0 R >> >> "
            f"/Contents {stream_id} 0 R >>"
        )
        page_ids.append(page_id)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    pdf.add_at(pages_id, f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>")
    catalog_id = pdf.add(f"<< /Type /Catalog /Pages {pages_id} 0 R /PageLayout /SinglePage >>")
    pdf.write(Path(output_path), catalog_id)
    print(f"Created {output_path} ({Path(output_path).stat().st_size:,} bytes, {len(page_ids)} pages)")


if __name__ == "__main__":
    build_deck()