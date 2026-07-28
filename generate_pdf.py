"""
Generate Qconnect executive pitch PDF using only Python stdlib (no external deps).
Produces a valid PDF 1.4 file with proper text layout, headers, and styling.
Run: python3 generate_pdf.py
Output: Qconnect_Executive_Pitch.pdf
"""

import struct, zlib, time

# ---------------------------------------------------------------------------
# Minimal PDF writer
# ---------------------------------------------------------------------------

def pdf_string(s):
    s = (s.replace("\u2014", "--").replace("\u2013", "-")
          .replace("\u2018", "'").replace("\u2019", "'")
          .replace("\u201c", '"').replace("\u201d", '"')
          .replace("\u2026", "..."))
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

class PDF:
    def __init__(self):
        self.objects = []   # list of (id, content_bytes)
        self.pages   = []   # page object ids
        self._next   = 1

    def _alloc(self):
        i = self._next
        self._next += 1
        return i

    def add_obj(self, content: str):
        oid = self._alloc()
        self.objects.append((oid, content.encode()))
        return oid

    def build(self) -> bytes:
        # catalog + page tree will be added last
        cat_id   = self._alloc()
        ptree_id = self._alloc()

        kids = " ".join(f"{p} 0 R" for p in self.pages)
        ptree_content = (
            f"{ptree_id} 0 obj\n"
            f"<< /Type /Pages /Kids [{kids}] /Count {len(self.pages)} >>\n"
            f"endobj\n"
        )
        cat_content = (
            f"{cat_id} 0 obj\n"
            f"<< /Type /Catalog /Pages {ptree_id} 0 R >>\n"
            f"endobj\n"
        )

        body = b"%PDF-1.4\n"
        offsets = {}

        all_objs = list(self.objects) + [
            (ptree_id, ptree_content.encode()),
            (cat_id,   cat_content.encode()),
        ]
        all_objs.sort(key=lambda x: x[0])

        for oid, raw in all_objs:
            offsets[oid] = len(body)
            header = f"{oid} 0 obj\n".encode()
            body += header + raw + b"\nendobj\n"

        xref_offset = len(body)
        xref = f"xref\n0 {self._next}\n0000000000 65535 f \n"
        for i in range(1, self._next):
            xref += f"{offsets[i]:010d} 00000 n \n"

        trailer = (
            f"trailer\n<< /Size {self._next} /Root {cat_id} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        body += (xref + trailer).encode()
        return body

    def add_page(self, ptree_id_placeholder, font_ids, content_stream: str):
        """Add a page. font_ids = {alias: font_obj_id}"""
        # Replace common Unicode chars not in latin-1
        content_stream = (content_stream
            .replace("\u2014", "--")   # em dash
            .replace("\u2013", "-")    # en dash
            .replace("\u2018", "'")    # left single quote
            .replace("\u2019", "'")    # right single quote
            .replace("\u201c", '"')    # left double quote
            .replace("\u201d", '"')    # right double quote
            .replace("\u2026", "...")  # ellipsis
            .replace("\u00b7", "·")   # middle dot (already latin-1)
        )
        stream_bytes = content_stream.encode("latin-1", errors="replace")
        stream_id = self._alloc()
        stream_obj = (
            f"<< /Length {len(stream_bytes)} >>\n"
            f"stream\n"
        ).encode() + stream_bytes + b"\nendstream"
        self.objects.append((stream_id, stream_obj))

        fonts_dict = " ".join(
            f"/{alias} {fid} 0 R" for alias, fid in font_ids.items()
        )
        page_id = self._alloc()
        page_obj = (
            f"<< /Type /Page\n"
            f"   /Parent {ptree_id_placeholder} 0 R\n"
            f"   /MediaBox [0 0 595 842]\n"
            f"   /Resources << /Font << {fonts_dict} >> >>\n"
            f"   /Contents {stream_id} 0 R\n"
            f">>"
        )
        self.objects.append((page_id, page_obj.encode()))
        self.pages.append(page_id)
        return page_id


# ---------------------------------------------------------------------------
# Fonts (standard PDF fonts, no embedding needed)
# ---------------------------------------------------------------------------

def add_font(pdf: PDF, base_font: str) -> int:
    oid = pdf._alloc()
    obj = (
        f"<< /Type /Font /Subtype /Type1\n"
        f"   /BaseFont /{base_font}\n"
        f"   /Encoding /WinAnsiEncoding\n"
        f">>"
    )
    pdf.objects.append((oid, obj.encode()))
    return oid


# ---------------------------------------------------------------------------
# Text layout helpers
# ---------------------------------------------------------------------------

CHAR_WIDTH_APPROX = 0.5   # fraction of font size (Times-Roman)
CHAR_WIDTH_BOLD   = 0.55

def wrap(text: str, max_chars: int) -> list:
    """Word-wrap a string to max_chars per line."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= max_chars:
            cur += " " + w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


# ---------------------------------------------------------------------------
# Page builder
# ---------------------------------------------------------------------------

PAGE_W, PAGE_H = 595, 842
MARGIN_L, MARGIN_R = 60, 60
MARGIN_T, MARGIN_B = 60, 60
TEXT_W = PAGE_W - MARGIN_L - MARGIN_R   # ~475 pts

# Approx chars that fit in TEXT_W at given font size
def max_chars(font_size, bold=False):
    cw = CHAR_WIDTH_BOLD if bold else CHAR_WIDTH_APPROX
    return int(TEXT_W / (font_size * cw))


class PageBuilder:
    def __init__(self, pdf: PDF, font_ids: dict, ptree_placeholder: int):
        self.pdf = pdf
        self.font_ids = font_ids
        self.ptree = ptree_placeholder
        self.pages_streams = []   # list of complete stream strings
        self._start_page()

    def _start_page(self):
        self._stream = []
        self._y = PAGE_H - MARGIN_T
        self._in_text = False

    def _bt(self):
        if not self._in_text:
            self._stream.append("BT")
            self._in_text = True

    def _et(self):
        if self._in_text:
            self._stream.append("ET")
            self._in_text = False

    def _flush_page(self):
        self._et()
        self.pages_streams.append("\n".join(self._stream))
        self.pdf.add_page(self.ptree, self.font_ids, "\n".join(self._stream))
        self._start_page()

    def _ensure_space(self, needed):
        if self._y - needed < MARGIN_B:
            self._flush_page()

    def spacer(self, pts):
        self._ensure_space(pts)
        self._y -= pts

    def draw_line(self):
        self._et()
        self._ensure_space(12)
        y = self._y
        self._stream.append(
            f"0.7 0.1 0.15 RG {MARGIN_L} {y:.1f} m {PAGE_W-MARGIN_R} {y:.1f} l S"
        )
        self._y -= 8

    def text_line(self, text: str, font: str, size: float,
                  color=(0.1, 0.1, 0.1), indent=0, line_height_factor=1.3):
        lh = size * line_height_factor
        self._ensure_space(lh + 2)
        r, g, b = color
        self._bt()
        x = MARGIN_L + indent
        self._stream.append(
            f"/{font} {size:.1f} Tf  "
            f"{r:.3f} {g:.3f} {b:.3f} rg  "
            f"{x:.1f} {self._y:.1f} Td  "
            f"({pdf_string(text)}) Tj  "
            f"0 0 Td"
        )
        self._et()
        self._y -= lh

    def paragraph(self, text: str, font: str, size: float,
                  color=(0.1, 0.1, 0.1), indent=0, line_height_factor=1.45,
                  space_after=6):
        mc = max_chars(size, bold=("Bold" in font))
        for line in wrap(text, mc):
            self.text_line(line, font, size, color, indent, line_height_factor)
        self._y -= space_after

    def heading(self, text: str, size=14, color=(0.72, 0.08, 0.12)):
        self.spacer(8)
        self._ensure_space(size * 1.4 + 10)
        self.paragraph(text, "HB", size, color=color, space_after=4)

    def sub_heading(self, text: str):
        self.paragraph(text, "HB", 10.5, color=(0.08, 0.2, 0.45), space_after=3)

    def body(self, text: str, indent=0):
        self.paragraph(text, "H", 10, color=(0.12, 0.12, 0.12),
                        indent=indent, space_after=5)

    def italic_body(self, text: str, indent=0):
        self.paragraph(text, "HI", 10, color=(0.25, 0.25, 0.25),
                        indent=indent, space_after=5)

    def label(self, text: str):
        self.paragraph(text, "HB", 9.5, color=(0.55, 0.55, 0.55), space_after=2)

    def finalize(self):
        self._flush_page()


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------

SPEECH = [
    ("TITLE",  "Qconnect — Executive Pitch"),
    ("SUBTITLE", "3-Minute Product Speech  ·  Executive / Visionary"),
    ("LINE",),
    ("SPACER", 10),

    ("SECTION", "Opening"),
    ("BODY",
     "For a century, we've poured our genius into medicine — into the science "
     "of what we treat. But a patient's experience is rarely decided by the medicine. "
     "It's decided by the operations around it. The wait. The confusion. The handoffs "
     "that drop. The urgent case that sits behind a routine one. And beneath all of "
     "that — a deeper, quieter crisis: data that isn't protected, records that aren't "
     "traceable, and systems that were never designed to be trusted with a human life."),
    ("BODY",
     "Healthcare's hardest bottleneck today isn't clinical knowledge. It isn't even "
     "coordination. It's the absence of a platform that is simultaneously intelligent, "
     "seamless, and — above all — safe. One that earns the trust of the patient, the "
     "clinician, and the regulator, all at once."),
    ("BODY", "That's the problem Qconnect was built to solve."),

    ("SPACER", 10),
    ("SECTION", "The Platform"),
    ("BODY",
     "Qconnect is a Smart Hospital Operating System — a real-time, AI-assisted platform "
     "that connects every role in the hospital: reception, triage, the consultation room, "
     "the lab, the pharmacy, and the patient on their phone — in one single, coordinated, "
     "and fully audited flow."),

    ("SPACER", 6),
    ("SECTION", "The Journey"),

    ("SUB", "Reception — Voice-Fill Registration"),
    ("BODY",
     "At the front desk, a receptionist speaks a patient's name, age, mobile number, and "
     "reason for visit aloud — and the registration form fills itself. No typing. No delay. "
     "Fully offline, on your own servers, with audio that never leaves the building."),

    ("SUB", "Triage — Real-Time Severity Routing"),
    ("BODY",
     "The patient moves to triage. Vitals from their last visit are already pre-populated. "
     "The triage engine flags severity in real time and routes the case instantly. The moment "
     "triage is complete, the doctor's queue updates live."),

    ("SUB", "Consultation — Ambient SOAP & Full Patient Context"),
    ("BODY",
     "The doctor has the patient's full history, active medications, known allergies, and "
     "prior diagnoses in one view. Our Ambient SOAP engine listens — transcribing speech, "
     "separating voices, suppressing noise — and drafts a structured clinical note "
     "automatically. The doctor looks up from the screen and back at the person."),

    ("SUB", "Lab & Pharmacy — Seamless Order Flow"),
    ("BODY",
     "Lab orders flow to the lab the moment they are placed. Results publish back in real "
     "time. Prescriptions reach the pharmacy before the patient leaves the room — supported "
     "by a live catalog of over a thousand medicines with intelligent generic substitution "
     "guidance."),

    ("SUB", "Oncology — Lifetime of Care"),
    ("BODY",
     "For complex oncology cases, Qconnect tracks cancer diagnoses, chemotherapy cycles, "
     "tumor board discussions, radiology and pathology reports, and long-term survivorship "
     "plans — so the platform holds not just a visit, but a lifetime of care."),

    ("SUB", "Command Center — Real-Time Visibility"),
    ("BODY",
     "For hospital leadership, a live Command Center replaces end-of-day reports with "
     "real-time visibility into patient flow, load, revenue, and risk."),

    ("SPACER", 6),
    ("SECTION", "Security & Trust"),
    ("BODY",
     "In healthcare, security is not a feature. It is the foundation."),
    ("BODY",
     "Every action on Qconnect is recorded in a tamper-evident audit log — who did what, "
     "to which patient, at what time, with what outcome. No record is ever silently changed. "
     "Every clinical write is tied to a verified identity. Every session is consent-gated — "
     "a patient's data cannot be accessed without an active, recorded consent artifact on file."),
    ("BODY",
     "All AI inference — transcription, diagnostics, prescription guidance — runs entirely "
     "on-premise. No patient audio, no imaging, no clinical text ever leaves your "
     "infrastructure. There is no third-party cloud in the diagnostic loop."),
    ("BODY",
     "The AI never has the final word. Every suggestion is a draft. Every clinical action "
     "requires a human — a nurse, a doctor — to approve it before anything touches the "
     "medical record. We built the entire platform around human judgment: consent-first, "
     "audit-ready, role-enforced, and aligned with modern data-protection standards."),
    ("BODY",
     "Access is layered. Staff identities are verified. Patient portals are OTP-authenticated. "
     "Every API is protected. Every data boundary is enforced."),

    ("SPACER", 6),
    ("SECTION", "5 Problems. 5 Solutions."),

    ("SUB", "1  |  Fragmented Patient Journey"),
    ("ITALIC",
     "Problem: Every department runs a disconnected system. One missed handoff and the patient is lost."),
    ("BODY",
     "Qconnect: One encounter record follows the patient through every department. "
     "Nothing drops. Nothing is re-entered."),

    ("SUB", "2  |  Clinical Administration Consuming Doctor Time"),
    ("ITALIC",
     "Problem: Doctors spend up to 50% of their time on documentation, not patients."),
    ("BODY",
     "Qconnect: Ambient SOAP drafts clinical notes automatically — offline, on-premise, "
     "with speaker diarization and noise suppression. Administration becomes attention."),

    ("SUB", "3  |  Patient Uncertainty and Disengagement"),
    ("ITALIC",
     "Problem: Patients sit in waiting rooms with no ETA, no status, no agency."),
    ("BODY",
     "Qconnect: The Patient Dashboard updates every 5 seconds — queue position, lab results, "
     "prescription, invoice — all on their phone."),

    ("SUB", "4  |  Data Security as an Afterthought"),
    ("ITALIC",
     "Problem: Patient audio streamed to external clouds. Records with no audit trail. Poorly enforced access."),
    ("BODY",
     "Qconnect: All AI runs on-premise. Every action is audit-logged. Consent is enforced "
     "at every data boundary. Built ABDM and data-protection compliant from day one."),

    ("SUB", "5  |  AI Overriding Human Judgment"),
    ("ITALIC",
     "Problem: Autonomous AI in clinical settings creates liability, erodes trust, and harms patients."),
    ("BODY",
     "Qconnect: Every AI output is a draft, never a decision. A human approves every clinical "
     "action before it touches the record. The AI removes friction. The human retains control. Always."),

    ("SPACER", 10),
    ("SECTION", "Ecosystem & Scale"),
    ("BODY",
     "Qconnect speaks the language of the ecosystem — FHIR, ICD-10, and ABDM — connecting "
     "to the national digital-health fabric instead of standing apart from it. This isn't a "
     "point solution. It's a foundation — production-ready, battle-tested, and built to scale "
     "to the demands of a full enterprise hospital."),

    ("SPACER", 10),
    ("LINE",),
    ("SPACER", 10),

    ("SECTION", "Vision"),
    ("BODY",
     "A hospital where the technology disappears, and all that's left is care — "
     "faster, safer, and profoundly more human."),
    ("BODY",
     "One connected journey. Intelligent at every step. Secure at every layer. "
     "Human at every decision."),
    ("SPACER", 12),
    ("TITLE_CLOSE", "That's Qconnect."),
]

PROBLEMS = []   # already embedded in SPEECH above


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_pdf(output_path="Qconnect_Executive_Pitch.pdf"):
    pdf = PDF()

    # Allocate font objects manually before page tree
    fR_id  = pdf._alloc();  pdf.objects.append((fR_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>"))
    fB_id  = pdf._alloc();  pdf.objects.append((fB_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"))
    fI_id  = pdf._alloc();  pdf.objects.append((fI_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>"))
    fHB_id = pdf._alloc();  pdf.objects.append((fHB_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"))
    fH_id  = pdf._alloc();  pdf.objects.append((fH_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"))
    fHI_id = pdf._alloc();  pdf.objects.append((fHI_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"))

    font_ids = {
        "R": fR_id, "B": fB_id, "I": fI_id,
        "HB": fHB_id, "H": fH_id, "HI": fHI_id,
    }

    # Reserve page-tree id (will be filled in build())
    ptree_placeholder = pdf._next + len(SPEECH) * 4 + 10  # safe upper bound
    # Actually just use a known slot; pdf.build() will compute the real ptree id.
    # We'll store ptree id after build — patch approach:
    # Simpler: pass a mutable container.
    ptree_ref = [0]

    pb = PageBuilder(pdf, font_ids, ptree_ref)

    ACCENT   = (0.72, 0.08, 0.12)   # deep red
    NAVY     = (0.05, 0.15, 0.35)
    DARK     = (0.08, 0.08, 0.08)
    MID      = (0.25, 0.25, 0.25)
    STEEL    = (0.35, 0.45, 0.60)

    for item in SPEECH:
        tag = item[0]

        if tag == "TITLE":
            pb.spacer(4)
            pb.paragraph(item[1], "HB", 20, color=ACCENT, space_after=4)

        elif tag == "SUBTITLE":
            pb.paragraph(item[1], "H", 10.5, color=STEEL, space_after=10)

        elif tag == "LINE":
            pb.draw_line()

        elif tag == "SPACER":
            pb.spacer(item[1])

        elif tag == "SECTION":
            pb.spacer(6)
            pb.paragraph(item[1].upper(), "HB", 9, color=ACCENT, space_after=3)
            pb.draw_line()
            pb.spacer(4)

        elif tag == "SUB":
            pb.spacer(6)
            pb.paragraph(item[1], "HB", 10.5, color=NAVY, space_after=2)

        elif tag == "BODY":
            pb.paragraph(item[1], "H", 10, color=DARK, space_after=6)

        elif tag == "ITALIC":
            pb.paragraph(item[1], "HI", 9.5, color=MID, indent=10, space_after=3)

        elif tag == "TITLE_CLOSE":
            pb.paragraph(item[1], "HB", 16, color=ACCENT, space_after=6)

    pb.finalize()

    # Now fix the page-tree placeholder: update all page /Parent refs
    # We need to know the real ptree id — it's assigned inside pdf.build().
    # Workaround: call build() which writes the real ptree id, then re-build.
    raw = pdf.build()
    with open(output_path, "wb") as f:
        f.write(raw)

    # Find actual ptree id from the built PDF and patch page Parent refs
    # Simpler: just let pdf.build() handle it — it writes the ptree id
    # dynamically. The placeholder 0 in /Parent will be wrong though.
    # Real fix: set ptree_ref[0] AFTER pdf.build() assigns it, then rebuild.

    # Actually pdf.build() assigns ptree_id = pdf._alloc() at the end.
    # At that point _next = current value. Let's track it properly:
    print(f"PDF written to: {output_path}")
    print(f"Pages: {len(pdf.pages)}")


# Rewrite with proper ptree wiring
def build():
    pdf = PDF()

    fR_id  = pdf._alloc();  pdf.objects.append((fR_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>"))
    fB_id  = pdf._alloc();  pdf.objects.append((fB_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"))
    fI_id  = pdf._alloc();  pdf.objects.append((fI_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>"))
    fHB_id = pdf._alloc();  pdf.objects.append((fHB_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"))
    fH_id  = pdf._alloc();  pdf.objects.append((fH_id,  b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"))
    fHI_id = pdf._alloc();  pdf.objects.append((fHI_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"))

    font_ids = {"R": fR_id, "B": fB_id, "I": fI_id,
                "HB": fHB_id, "H": fH_id, "HI": fHI_id}

    # We reserve the ptree id NOW so pages can reference it
    ptree_id = pdf._alloc()

    class PB2(PageBuilder):
        def __init__(self):
            super().__init__(pdf, font_ids, ptree_id)

    pb = PB2()

    ACCENT = (0.72, 0.08, 0.12)
    NAVY   = (0.05, 0.15, 0.35)
    DARK   = (0.08, 0.08, 0.08)
    MID    = (0.25, 0.25, 0.25)
    STEEL  = (0.35, 0.45, 0.60)

    for item in SPEECH:
        tag = item[0]
        if tag == "TITLE":
            pb.spacer(4)
            pb.paragraph(item[1], "HB", 20, color=ACCENT, space_after=4)
        elif tag == "SUBTITLE":
            pb.paragraph(item[1], "H", 10.5, color=STEEL, space_after=10)
        elif tag == "LINE":
            pb.draw_line()
        elif tag == "SPACER":
            pb.spacer(item[1])
        elif tag == "SECTION":
            pb.spacer(6)
            pb.paragraph(item[1].upper(), "HB", 9, color=ACCENT, space_after=3)
            pb.draw_line()
            pb.spacer(4)
        elif tag == "SUB":
            pb.spacer(6)
            pb.paragraph(item[1], "HB", 10.5, color=NAVY, space_after=2)
        elif tag == "BODY":
            pb.paragraph(item[1], "H", 10, color=DARK, space_after=6)
        elif tag == "ITALIC":
            pb.paragraph(item[1], "HI", 9.5, color=MID, indent=10, space_after=3)
        elif tag == "TITLE_CLOSE":
            pb.paragraph(item[1], "HB", 16, color=ACCENT, space_after=6)

    pb.finalize()

    # Manually insert the Pages object at the reserved ptree_id slot
    kids = " ".join(f"{p} 0 R" for p in pdf.pages)
    ptree_obj = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(pdf.pages)} >>"
    ).encode()
    pdf.objects.append((ptree_id, ptree_obj))

    # Catalog
    cat_id = pdf._alloc()
    cat_obj = f"<< /Type /Catalog /Pages {ptree_id} 0 R >>".encode()
    pdf.objects.append((cat_id, cat_obj))

    # Build raw bytes manually (bypass pdf.build() which would add another ptree+cat)
    body = b"%PDF-1.4\n"
    offsets = {}
    all_objs = sorted(pdf.objects, key=lambda x: x[0])

    for oid, raw in all_objs:
        offsets[oid] = len(body)
        body += f"{oid} 0 obj\n".encode() + raw + b"\nendobj\n"

    xref_offset = len(body)
    n = max(offsets.keys()) + 1
    xref = f"xref\n0 {n}\n0000000000 65535 f \n"
    for i in range(1, n):
        xref += f"{offsets.get(i, 0):010d} 00000 n \n"

    trailer = (
        f"trailer\n<< /Size {n} /Root {cat_id} 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )
    body += (xref + trailer).encode()

    out = "Qconnect_Executive_Pitch.pdf"
    with open(out, "wb") as f:
        f.write(body)
    print(f"Done: {out}  ({len(body):,} bytes, {len(pdf.pages)} pages)")


if __name__ == "__main__":
    build()
