"""The agent mesh.

Each agent = a deterministic, auditable clinical core (safe, offline-capable) + an optional LLM
narrative layer on top. Safety-critical decisions (red flags, allergy conflicts, interactions,
abnormal flags) are ALWAYS computed by rules; the LLM only enriches human-readable text.
Every clinical output is returned as a *draft that requires approval*.
"""
from __future__ import annotations

import re
from typing import Any, Callable

from app.ai import knowledge as kb
from app.ai.gateway import gateway
from app.ai.guardrails import envelope, redact_pii
from app.core.config import settings


def _source() -> str:
    if not gateway.available():
        return "deterministic-engine"
    return f"llm:{gateway.active_model_name()}"


def _any_keyword(keywords: list[str], text: str) -> bool:
    """Word-boundary keyword match — avoids false positives like short tokens
    (e.g. "UTI") incidentally matching inside unrelated words (e.g. "ROUTINE")."""
    return any(re.search(r"\b" + re.escape(kw) + r"\b", text) for kw in keywords)


def _high_temperature_threshold_f() -> float:
    """Return the configured Fahrenheit fever threshold."""
    return float(
        kb.VITAL_THRESHOLDS.get(
            "temp_high_f",
            kb.VITAL_THRESHOLDS.get("temp_high", 103.0),
        )
    )


# ------------------------------------------------------------------------------------ Intake Agent
def intake_agent(symptom_text: str, *, duration: str | None = None) -> dict[str, Any]:
    red_flags = kb.detect_red_flags(symptom_text)
    chief = (symptom_text or "").strip()[:1000]

    summary = None
    prompt = (
        "You are a clinical intake assistant. In 1-2 sentences, neutrally summarise the patient's "
        "presenting complaint for a triage nurse. Do not diagnose.\n\n"
        f"Patient says: {redact_pii(symptom_text)}\n"
        f"Duration: {duration or 'unspecified'}"
    )
    llm = gateway.generate(prompt, temperature=0.1)
    if llm:
        summary = llm.strip()
    if not summary:
        dur = f" for {duration}" if duration else ""
        summary = f"Patient reports {chief.lower()}{dur}."

    return envelope(
        {
            "chief_complaint": chief,
            "symptom_summary": summary,
            "red_flags": red_flags,
            "duration": duration,
        },
        agent="Intake",
        needs_approval=True,
        source=_source(),
        citations=["ESI triage red-flag list"],
    )


# ------------------------------------------------------------------------------------ Triage Agent
def triage_agent(
    chief_complaint: str,
    symptom_summary: str,
    vitals: dict[str, Any] | None,
    age: int | None,
) -> dict[str, Any]:
    vitals = vitals or {}
    combined = f"{chief_complaint} {symptom_summary}"
    red_flags = kb.detect_red_flags(combined)

    # Vitals-driven acuity escalation
    critical_vital = False
    reasons: list[str] = list(red_flags)
    spo2 = vitals.get("spo2")
    sbp = vitals.get("bp_systolic")
    hr = vitals.get("heart_rate")
    temp = vitals.get("temperature")
    if spo2 is not None and spo2 < kb.VITAL_THRESHOLDS["spo2_critical"]:
        critical_vital = True
        reasons.append(f"SpO₂ {spo2}% below {kb.VITAL_THRESHOLDS['spo2_critical']}%.")
    if sbp is not None and sbp < kb.VITAL_THRESHOLDS["sbp_low"]:
        critical_vital = True
        reasons.append(f"Systolic BP {sbp} mmHg (hypotension).")
    if hr is not None and hr > kb.VITAL_THRESHOLDS["hr_high"]:
        reasons.append(f"Heart rate {hr} bpm (tachycardia).")
    if temp is not None and temp >= _high_temperature_threshold_f():
        reasons.append(f"Temperature {temp}°F (high-grade fever).")

    if critical_vital:
        acuity = "1"
    elif red_flags:
        acuity = "2"
    elif hr and hr > kb.VITAL_THRESHOLDS["hr_high"] or (temp and temp >= _high_temperature_threshold_f()):
        acuity = "3"
    else:
        acuity = "3" if (age and (age < 2 or age > 70)) else "4"

    specialty = kb.route_specialty(combined)
    reason = " ".join(reasons) if reasons else "Stable vitals; routine outpatient assessment."

    return envelope(
        {
            "acuity_level": acuity,
            "specialty": specialty,
            "red_flag": bool(red_flags or critical_vital),
            "red_flag_reason": reason if (red_flags or critical_vital) else None,
            "rationale": reason,
        },
        agent="Triage",
        needs_approval=True,
        source=_source(),
        citations=["Emergency Severity Index (ESI) v4", "Vital-sign escalation thresholds"],
    )


# ------------------------------------------------------------------------------- Ambient Docs Agent
def _abnormal_vitals(vitals: dict[str, Any]) -> list[str]:
    """Deterministic vital-sign safety check — same thresholds used at triage — so the SOAP's
    Objective section always calls out anything dangerous even if the LLM narrative misses it."""
    flags: list[str] = []
    spo2 = vitals.get("spo2")
    hr = vitals.get("heart_rate")
    sbp = vitals.get("bp_systolic")
    temp = vitals.get("temperature")
    rr = vitals.get("respiratory_rate")
    if spo2 is not None and spo2 <= kb.VITAL_THRESHOLDS["spo2_critical"]:
        flags.append(f"SpO2 critically low ({spo2}%)")
    if hr is not None and hr >= kb.VITAL_THRESHOLDS["hr_high"]:
        flags.append(f"Tachycardia (HR {hr} bpm)")
    if hr is not None and hr <= kb.VITAL_THRESHOLDS["hr_low"]:
        flags.append(f"Bradycardia (HR {hr} bpm)")
    if sbp is not None and sbp >= kb.VITAL_THRESHOLDS["sbp_high"]:
        flags.append(f"Hypertensive (SBP {sbp} mmHg)")
    if sbp is not None and sbp <= kb.VITAL_THRESHOLDS["sbp_low"]:
        flags.append(f"Hypotensive (SBP {sbp} mmHg)")
    if temp is not None and temp >= _high_temperature_threshold_f():
        flags.append(f"High-grade fever ({temp}°F)")
    if rr is not None and rr >= kb.VITAL_THRESHOLDS["rr_high"]:
        flags.append(f"Tachypnea (RR {rr}/min)")
    return flags


def ambient_docs_agent(transcript: str, patient_context: dict[str, Any]) -> dict[str, Any]:
    icd10 = kb.suggest_icd10(transcript)
    # dict.fromkeys dedupes while preserving order — multiple keyword hits (e.g. "chest pain"
    # and "crushing chest") can map to the same escalation reason text.
    red_flags = list(dict.fromkeys(kb.detect_red_flags(transcript)))
    abnormal_vitals = _abnormal_vitals(patient_context.get("vitals") or {})
    allergies = patient_context.get("allergies") or []
    allergy_names = [a.get("substance") for a in allergies if a.get("substance")]

    soap: dict[str, str] | None = None
    system = (
        "You are an expert ambient clinical scribe with training equivalent to an experienced "
        "attending physician. Convert the consultation transcript into a rigorous, clinically "
        "sound SOAP note.\n\n"
        "Reasoning approach (internal — do not output your reasoning, only the final JSON):\n"
        "1. Identify the patient's own reported symptoms, duration, and severity — this is the "
        "Subjective (S) section, written in the patient's voice/perspective.\n"
        "2. Identify only objectively observed/measured findings (vitals, exam findings the "
        "doctor states aloud, diagnostic results mentioned) — this is Objective (O). If vitals "
        "are abnormal, explicitly call that out.\n"
        "3. Synthesize a clinical Assessment (A) — likely diagnosis/differential — that is "
        "directly supported by S and O plus the patient's known chronic problems and allergy "
        "history (never contradict a known drug allergy).\n"
        "4. Write an actionable Plan (P) — investigations, treatment, follow-up timeframe, and "
        "any red-flag/safety-netting advice appropriate to the presentation.\n\n"
        "Rules: Return STRICT JSON with keys S, O, A, P (plain strings, no markdown). Be "
        "factual — never invent vitals, exam findings, or history not present in the transcript "
        "or provided context. The transcript may be in any language (patients and doctors may "
        "speak Hindi, Tamil, or other languages, and turns may be labeled 'Speaker N:') — ALWAYS "
        "write the SOAP note itself in English, regardless of the transcript's language, so the "
        "clinical record stays standardized."
    )
    context_lines = [
        f"Patient: {patient_context.get('age', '?')}{patient_context.get('gender', '')}.",
        f"Active chronic problems: {patient_context.get('problems', 'none recorded')}.",
        f"Known drug/substance allergies: {', '.join(allergy_names) if allergy_names else 'none recorded'}.",
    ]
    if patient_context.get("vitals_line"):
        context_lines.append(f"Latest vitals: {patient_context['vitals_line']}")
    if abnormal_vitals:
        context_lines.append(f"⚠ Abnormal vitals flagged by monitoring system: {'; '.join(abnormal_vitals)}.")
    if icd10:
        hints = ", ".join(f"{c['code']} ({c['label']})" for c in icd10)
        context_lines.append(f"Candidate ICD-10 codes suggested by symptom matching (use only if clinically consistent): {hints}.")
    if red_flags:
        context_lines.append(f"⚠ Red-flag keywords detected in transcript — {'; '.join(red_flags)}. Reflect appropriate urgency in the Assessment/Plan if genuinely applicable.")

    prompt = "\n".join(context_lines) + f"\n\nTranscript:\n{redact_pii(transcript)}"
    llm = gateway.generate_json(prompt, system=system)
    if isinstance(llm, dict) and {"S", "O", "A", "P"} <= set(llm):
        soap = {k: str(llm[k]) for k in ("S", "O", "A", "P")}

    if not soap:
        # Deterministic fallback SOAP — still grounded in the same problems/allergies/vitals/
        # red-flag context so offline quality doesn't regress just because the LLM is unreachable.
        chief = patient_context.get("chief_complaint", "the presenting complaint")
        vit = patient_context.get("vitals_line", "")
        dx = icd10[0]["label"] if icd10 else "clinical impression pending"
        code = f" (ICD-10 {icd10[0]['code']})" if icd10 else ""
        o_parts = [vit] if vit else []
        if abnormal_vitals:
            o_parts.append(f"Abnormal: {'; '.join(abnormal_vitals)}.")
        plan_parts = ["Investigations as ordered", "symptomatic treatment", "review in 48 hours or earlier if worsening"]
        if allergy_names:
            plan_parts.insert(0, f"avoid {', '.join(allergy_names)} and cross-reacting agents (documented allergy)")
        soap = {
            "S": f"{patient_context.get('age', '')}{patient_context.get('gender', '')} presenting with {chief}. {transcript[:200]}".strip(),
            "O": " ".join(o_parts) if o_parts else "Examination findings to be documented.",
            "A": f"{dx}{code}." + (f" Active chronic problem(s): {patient_context.get('problems')}." if patient_context.get("problems") and patient_context.get("problems") != "none recorded" else ""),
            "P": "; ".join(plan_parts) + ".",
        }

    draft_text = f"S: {soap['S']}\nO: {soap['O']}\nA: {soap['A']}\nP: {soap['P']}"
    return envelope(
        {
            "soap": soap,
            "icd10": icd10,
            "draft_text": draft_text,
            "red_flags": red_flags,
            "abnormal_vitals": abnormal_vitals,
            "allergies_considered": allergy_names,
        },
        agent="Ambient Docs",
        needs_approval=True,
        source=_source(),
        citations=["ICD-10", "SOAP documentation standard"],
    )


# -------------------------------------------------------------------------- Lab Intelligence Agent
def _flag_for(value: float | None, low: float | None, high: float | None) -> str:
    if value is None:
        return "N"
    if high is not None and value > high:
        return "HH" if value > high * 1.5 else "H"
    if low is not None and value < low:
        return "LL" if value < low * 0.5 else "L"
    return "N"


def lab_intelligence_agent(results: list[dict[str, Any]]) -> dict[str, Any]:
    structured: list[dict[str, Any]] = []
    abnormal: list[dict[str, Any]] = []
    for r in results:
        flag = r.get("abnormal_flag") or _flag_for(
            r.get("value"), r.get("reference_low"), r.get("reference_high")
        )
        item = {**r, "abnormal_flag": flag}
        structured.append(item)
        if flag != "N":
            abnormal.append(item)

    if abnormal:
        names = ", ".join(f"{a.get('analyte', a.get('test_code'))} {a.get('value')}{a.get('unit', '')}" for a in abnormal)
        summary = f"{len(abnormal)} abnormal result(s): {names}. Correlate clinically."
    else:
        summary = "All results within reference ranges."

    return envelope(
        {"structured": structured, "abnormal": abnormal, "summary": summary},
        agent="Lab Intelligence",
        needs_approval=True,
        source="deterministic-engine",
        citations=["Reference interval ranges"],
    )


# ------------------------------------------------------------------------- Suggested Orders Agent
def suggest_orders_agent(
    chief_complaint: str,
    symptom_summary: str,
    vitals: dict[str, Any] | None,
    history: list[str],
) -> list[dict[str, str]]:
    """AI suggests relevant lab or imaging orders based on patient symptoms, vitals, and history.
    
    Only suggests tests from the allowed catalog: CBC, CRP, HbA1c, Lipid Profile, TSH, RFT, Chest X-ray.
    If no tests are strongly indicated, returns an empty list [].
    """
    if not gateway.available():
        return []

    vitals = vitals or {}
    vitals_parts = []
    for k, v in vitals.items():
        if v is not None:
            vitals_parts.append(f"{k}: {v}")
    vitals_str = ", ".join(vitals_parts) if vitals_parts else "None recorded"
    
    history_str = ", ".join(history) if history else "None recorded"
    
    prompt = (
        "You are an expert clinical triage assistant. Evaluate the patient's clinical presentation below "
        "to determine if any diagnostic laboratory or imaging tests are indicated.\n\n"
        f"Chief Complaint: {chief_complaint}\n"
        f"Symptom Summary: {symptom_summary}\n"
        f"Vitals: {vitals_str}\n"
        f"Medical History: {history_str}\n\n"
        "Guidelines:\n"
        "1. Suggest 2-3 relevant diagnostic tests (such as CBC, CRP, HbA1c, Lipid Profile, TSH, RFT, LFT, Urinalysis, Widal Test, Chest X-ray, ECG, etc.) that are clinically reasonable to confirm the diagnosis, check severity, or rule out complications.\n"
        "2. For respiratory symptoms (like cough, cold, breathlessness), consider CBC and Chest X-ray.\n"
        "3. For febrile symptoms (like high fever, chills), consider CBC, CRP, and Widal Test.\n"
        "4. For metabolic symptoms or checkups (fatigue, diabetes), consider HbA1c, RFT, and Lipid Profile.\n"
        "5. Output MUST be a JSON array of objects, where each object has:\n"
        "   - 'test': exact name of the diagnostic test (e.g., 'CBC', 'Chest X-ray', 'TSH', etc.)\n"
        "   - 'reason': a brief clinical explanation (5-10 words) of why it is indicated.\n\n"
        "Do not include any markdown formatting, code block backticks, or surrounding text. Return only the raw JSON array."
    )
    
    try:
        res = gateway.generate_json(prompt)
        if isinstance(res, dict):
            for val in res.values():
                if isinstance(val, list):
                    res = val
                    break
        if isinstance(res, list):
            validated = []
            for item in res:
                if isinstance(item, dict) and item.get("test"):
                    validated.append({
                        "test": str(item["test"]).strip(),
                        "reason": str(item.get("reason", "Clinically indicated.")),
                    })
            return validated
    except Exception as e:
        logger.warning("suggest_orders_agent failed: %s", str(e))
        
    return []


# --------------------------------------------------------------------------------- Rx CDS Agent
def rx_cds_agent(
    allergies: list[dict[str, Any]],
    current_meds: list[str],
    proposed_items: list[dict[str, Any]],
    patient_context: dict[str, Any] | None = None,
    stock_index: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    stock_index = stock_index or {}
    
    ai_success = False
    block = False
    alerts: list[dict[str, Any]] = []
    suggestions: list[dict[str, Any]] = []
    
    # 1. Try dynamic AI evaluation first (without sending the pharmacy stock list)
    if gateway.available():
        try:
            allergies_str = ", ".join([
                f"{a.get('substance', 'Unknown')} ({a.get('drug_class', 'class') or 'Unknown class'})"
                for a in allergies
            ]) if allergies else "None"
            proposed_str = ", ".join([f"{i.get('drug_name')} ({i.get('dose', '')})" for i in proposed_items])
            
            # Format patient clinical context
            ctx = patient_context or {}
            issue = ctx.get("issue") or "Consultation ongoing"
            vitals = ctx.get("vitals") or {}
            vitals_str = f"BP: {vitals.get('bp') or '?'}, SpO2: {vitals.get('spo2') or '?'}%, HR: {vitals.get('heart_rate') or '?'} bpm, Temp: {vitals.get('temperature') or '?'}F"
            history_str = "; ".join(ctx.get("history", [])) or "None recorded"
            
            prompt = (
                "You are an expert clinical decision support (CDS) assistant. Evaluate the proposed prescription items against the patient's clinical context.\n\n"
                f"Proposed Prescription Items: {proposed_str}\n"
                f"Patient Allergies: {allergies_str}\n"
                f"Patient Reason for Visit: {issue}\n"
                f"Patient Vitals: {vitals_str}\n"
                f"Past Serious Conditions / Medical History: {history_str}\n\n"
                "Evaluate and generate alerts for the proposed medicines:\n"
                "1. Drug-Allergy Warning: Alert if any proposed medicine conflicts with the patient's allergies.\n"
                "2. Potential Side Effects: For EACH proposed medicine, list its common or clinically significant side effects (e.g. gastric upset for Ibuprofen, QTc prolongation for Azithromycin, peripheral edema for Amlodipine, etc.) and highlight if they could impact this patient's current symptoms, abnormal vitals, or history.\n"
                "3. Appropriateness: State if a medicine is not directly related to the patient's presenting symptoms or medical history.\n\n"
                "Note: Do not suggest alternative medicines. Keep alerts objective. The final decision is taken by the doctor.\n\n"
                "Respond with a JSON object containing keys:\n"
                "- 'block': boolean (true if there is an active allergy conflict with proposed meds, else false)\n"
                "- 'alerts': list of objects, each containing:\n"
                "  - 'drug': name of the proposed drug\n"
                "  - 'severity': 'BLOCK' (for allergy conflicts), 'WARN' (for significant side effects/interactions), or 'INFO' (for appropriateness/general side effects)\n"
                "  - 'type': 'ALLERGY', 'SIDE_EFFECT', or 'UNRELATED'\n"
                "  - 'message': a brief clinical explanation in general terms (e.g., 'Allergy conflict: Patient allergic to Ibuprofen.' or 'Side effects: May cause stomach irritation or worsen asthma symptoms.' or 'Not directly related to current symptoms.')\n"
                "- 'suggestions': [] (must be an empty list)\n\n"
                "Do not add any markdown formatting or surrounding text, just return the raw JSON object."
            )
            
            res = gateway.generate_json(prompt)
            if isinstance(res, dict) and "alerts" in res:
                block = bool(res.get("block", False))
                alerts = res.get("alerts", [])
                suggestions = res.get("suggestions", [])
                ai_success = True
        except Exception as e:
            logger.warning("Dynamic Rx CDS agent failed: %s; falling back to deterministic backup", str(e))
            
    # 2. Fallback to deterministic rules if AI failed to respond
    if not ai_success:
        suggestions.append({
            "for": proposed_items[0].get("drug_name") if proposed_items else "Prescription",
            "suggestion": "No response was returned",
            "reason": "Clinical model suggestion failed"
        })
        
        # Pull deterministic warnings from DB/Code as a safety net
        allergy_classes = {(a.get("drug_class") or "").lower() for a in allergies if a.get("drug_class")}
        allergy_substances = {(a.get("substance") or "").lower() for a in allergies}
        all_meds_lower = [m.lower() for m in current_meds]
        
        for item in proposed_items:
            name = item.get("drug_name", "")
            name_l = name.lower()
            cls = kb.drug_class_of(name)
            
            # Allergy warning (Rule-based backup)
            if (cls and cls in allergy_classes) or any(s and s in name_l for s in allergy_substances):
                block = True
                alerts.append({
                    "severity": "BLOCK",
                    "type": "ALLERGY",
                    "drug": name,
                    "message": f"[Rule-Based Safety Backup] Allergy conflict: patient allergic to {cls or 'this substance'}. Choose an alternative.",
                })
                
            # Drug-drug interaction warning (Rule-based backup)
            for a, b, sev, msg in kb.DRUG_INTERACTIONS:
                partners = all_meds_lower + [i.get("drug_name", "").lower() for i in proposed_items if i is not item]
                if a.strip() in name_l and any(b.strip() in p for p in partners):
                    alerts.append({
                        "severity": sev,
                        "type": "INTERACTION",
                        "drug": name,
                        "message": f"[Rule-Based Safety Backup] {msg}"
                    })
                    
    # 3. Independent Stock Checking (Determined from Postgres db, not Gemini)
    for item in proposed_items:
        name = item.get("drug_name", "")
        name_l = name.lower()
        
        rec = None
        if name_l in stock_index:
            rec = stock_index[name_l]
        else:
            for cand_name, cand in stock_index.items():
                if name_l in cand_name or cand_name in name_l:
                    rec = cand
                    break
                    
        if rec is None:
            alerts.append({
                "severity": "INFO",
                "type": "STOCK",
                "drug": name,
                "message": "Not found in pharmacy stock."
            })
        elif rec.get("available", 0) <= 0:
            alerts.append({
                "severity": "WARN",
                "type": "STOCK",
                "drug": name,
                "message": "Out of stock."
            })
        elif rec.get("formulary") is False:
            alerts.append({
                "severity": "INFO",
                "type": "FORMULARY",
                "drug": name,
                "message": "Non-formulary item."
            })
                
    return envelope(
        {"alerts": alerts, "suggestions": suggestions, "block": block},
        agent="Rx CDS",
        needs_approval=True,
        source="llm" if ai_success else "deterministic-engine",
        citations=["Google Gemini safety checks" if ai_success else "Allergy cross-reactivity table"],
    )



# ------------------------------------------------------------------------------- Compliance Agent
def compliance_agent(bundle: dict[str, Any]) -> dict[str, Any]:
    gaps: list[dict[str, str]] = []
    if not bundle.get("has_consent"):
        gaps.append({"area": "Consent", "detail": "No active consent artifact on record."})
    if not bundle.get("has_vitals"):
        gaps.append({"area": "Vitals", "detail": "Vitals not captured for this encounter."})
    if not bundle.get("note_approved"):
        gaps.append({"area": "Documentation", "detail": "Clinical note not approved by clinician."})
    if not bundle.get("has_diagnosis"):
        gaps.append({"area": "Coding", "detail": "No ICD-10 diagnosis code recorded."})
    if bundle.get("has_prescription") and not bundle.get("rx_approved"):
        gaps.append({"area": "Prescription", "detail": "Prescription drafted but not e-signed."})

    return envelope(
        {"gaps": gaps, "complete": not gaps},
        agent="Compliance",
        needs_approval=False,
        source="deterministic-engine",
        citations=["OPD documentation completeness checklist"],
    )


# ---------------------------------------------------------------------------- Command-Center Agent
def command_center_agent(metrics: dict[str, Any]) -> dict[str, Any]:
    alerts: list[dict[str, str]] = []
    if metrics.get("lab_tat_minutes", 0) > 45:
        alerts.append({"level": "SLA", "message": f"Lab TAT {metrics['lab_tat_minutes']}m exceeds 45m target."})
    for drug, qty in (metrics.get("low_stock") or {}).items():
        alerts.append({"level": "STOCK", "message": f"{drug} low ({qty} left)."})
    if metrics.get("queue_depth", 0) > 25:
        alerts.append({"level": "FLOW", "message": f"Queue depth {metrics['queue_depth']} — consider adding a provider."})
    if metrics.get("compliance_gaps", 0) > 0:
        alerts.append({"level": "COMPLIANCE", "message": f"{metrics['compliance_gaps']} open documentation gap(s)."})

    return envelope(
        {"alerts": alerts},
        agent="Command-Center",
        needs_approval=False,
        source="deterministic-engine",
    )


# ------------------------------------------------------------------------- Patient Summary Agent
def patient_summary_agent(
    patient_brief: dict[str, Any],
    allergies: list[dict[str, Any]],
    active_meds: list[str],
    recent_notes: list[dict[str, Any]],
    latest_vitals: dict[str, Any] | None,
    issues_str: str,
) -> dict[str, Any]:
    """Generates an AI-drafted summary of the patient's medical history."""
    allergies_str = ", ".join(a.get("substance", "") for a in allergies) or "No known allergies"
    meds_str = ", ".join(active_meds) or "No active medications"
    vitals_str = ""
    if latest_vitals:
        vitals_str = f"BP {latest_vitals.get('bp')}, SpO₂ {latest_vitals.get('spo2')}%"
    
    past_diagnoses = []
    for n in recent_notes[:3]:
        past_diagnoses.append(f"On {n.get('date')}: {n.get('text', '')[:80]}...")
    diagnoses_str = "; ".join(past_diagnoses) or "No past visit notes"

    summary = None
    prompt = (
        "You are an expert clinical summarizer. Summarize the following patient history in 2-3 concise bullet points "
        "for the consulting doctor.\n\n"
        f"Patient: {patient_brief.get('name')}, {patient_brief.get('age')} years, {patient_brief.get('gender')}.\n"
        f"Chronic Medical Issues: {issues_str}\n"
        f"Allergies: {allergies_str}\n"
        f"Active Meds: {meds_str}\n"
        f"Latest Vitals: {vitals_str}\n"
        f"Past History: {diagnoses_str}\n"
        "Be factual, clinical, and highlight critical concerns (especially chronic issues/warnings and allergies)."
    )
    llm = gateway.generate(prompt, temperature=0.1)
    if llm:
        summary = llm.strip()
    if not summary:
        summary = "No response was returned"

    return envelope(
        {"summary": summary},
        agent="Patient History Summary",
        needs_approval=False,
        source=_source(),
        citations=["Patient medical record timeline"],
    )


def refine_notes_agent(notes_text: str, chief_complaint: str) -> str:
    if not notes_text or not notes_text.strip():
        return notes_text
        
    if not gateway.available():
        return notes_text

    prompt = (
        "You are an expert clinical assistant. You are given a doctor's informal/rough consultation notes and the patient's chief complaint.\n\n"
        f"Patient Chief Complaint: {chief_complaint}\n"
        f"Doctor's Original Notes: {notes_text}\n\n"
        "Your task is to:\n"
        "1. Correct any spelling, grammar, punctuation, or medical terminology typos in the notes.\n"
        "2. Refine the style to be clean, professional, and medically sound.\n"
        "3. Keep the refined note short and concise, of similar length to the doctor's original notes (do NOT generate long summaries, general templates, or add unrelated advice).\n"
        "4. Align the advice with the patient's issue/chief complaint, preserving all doctor intent and clinical advice exactly.\n\n"
        "Output ONLY the final refined notes text. Do not include any introductory, concluding, or markdown commentary (like 'Here is the refined note:')."
    )
    try:
        refined = gateway.generate(prompt, temperature=0.2)
        refined_clean = refined.strip()
        if refined_clean:
            return refined_clean
    except Exception as e:
        print(f"Error in refine_notes_agent: {e}")
    return notes_text


# ------------------------------------------------------------------ AI Formulary Guidance Agent
def formulary_guidance_agent(
    patient_name: str,
    chief_complaint: str,
    patient_issues: list[str],
    ai_diagnostics: list[dict[str, Any]],
    vitals: dict[str, Any] | None = None
) -> dict[str, Any]:
    """AI Pharmacological & Generic Formula Guidance Agent.
    
    Analyzes Patient Medical Issues and PyTorch Local AI Diagnostic Scan Findings
    to recommend Generic Formulations, Pharmacological Classes, and Clinical Rationales.
    Zero brand names — pure generic formulation guidance.
    """
    import json
    def _safe(val: Any) -> str:
        return str(val).encode("ascii", errors="replace").decode("ascii")

    print("\n" + "=" * 76)
    print("[AI PHARMACOLOGICAL & GENERIC FORMULA GUIDANCE AGENT EXECUTING]")
    print("=" * 76)
    print(f"* Patient: {_safe(patient_name)}")
    print(f"* Chief Complaint: {_safe(chief_complaint)}")
    print(f"* Patient Medical Issues: {_safe(patient_issues)}")
    print(f"* Local PyTorch AI Scan Findings: {_safe(ai_diagnostics)}")
    print("-" * 76)

    prompt = f"""You are a world-class Clinical Pharmacologist and Evidence-Based Formulary AI Assistant with expertise across all major international pharmacopeias — WHO Essential Medicines List, BNF (UK), FDA Orange Book (USA), European Pharmacopoeia, Indian Pharmacopoeia, Australian Medicines Handbook, and the Japanese, Chinese, and Brazilian national formularies.

Analyze the following patient clinical context and provide comprehensive generic formulation recommendations for the consulting physician.

ANONYMIZED PATIENT CLINICAL CONTEXT:
- Present Chief Complaint (Current Visit Only): {chief_complaint}
- Major Chronic Co-morbidities (Systemic Conditions Only): {', '.join(patient_issues) if patient_issues else 'None (No active chronic co-morbidities)'}
- PyTorch Local AI Diagnostic Findings & Lab Reports (Current Visit Only): {json.dumps(ai_diagnostics)}

CRITICAL MANDATES:
1. DO NOT mention drug brand names. Output ONLY generic active formulations and pharmacological classes (e.g. Paracetamol 650mg, Levofloxacin 500mg, Azithromycin 250mg, Amoxicillin + Clavulanic Acid 625mg, Semaglutide 0.5mg SC weekly).
2. Directly correlate recommendations to the Present Chief Complaint ({chief_complaint}) and the Current Visit PyTorch AI Diagnostic Results.
3. Include recommendations from ALL relevant specialties: Cardiology, Respiratory, Endocrinology, Gastroenterology, Neurology, Psychiatry, Infectious Disease, Musculoskeletal, Allergy/Immunology, Dermatology, Urology/Nephrology, Haematology, Ophthalmology, Oncology Supportive, ENT, Obstetrics/Gynaecology, and Paediatrics as applicable.
4. Reference international evidence-based guidelines (ACC/AHA, ESC, WHO, NICE, IDSA, GINA, GOLD, ADA/EASD, AAN, EULAR, ACR, ASCO, ILAE) to substantiate each recommendation.
5. DO NOT suggest medications for old or unstated symptoms. Stay strictly focused on the current presentation and lab findings.
6. For each recommendation, specify the exact dosage including weight/renal adjustments where clinically critical.

Return ONLY a valid JSON object matching this schema:
{{
  "formula_recommendations": [
    {{
      "category": "Specialty / Condition category",
      "formula_name": "Generic Formula Title",
      "active_ingredients": "Generic active ingredients with exact dose",
      "class": "Pharmacological class",
      "dosage_guidance": "Recommended schedule, route & duration with titration guidance",
      "clinical_rationale": "Evidence-based rationale citing guideline source and patient-specific reasoning from chief complaint and AI diagnostics",
      "safety_note": "Key safety monitoring, contraindications, or precautions"
    }}
  ]
}}"""

    formulas = []

    # Try LLM Gateway first
    llm_resp = gateway.generate(prompt, temperature=0.1)
    if llm_resp:
        try:
            clean_str = llm_resp.strip()
            if clean_str.startswith("```"):
                clean_str = clean_str.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            parsed = json.loads(clean_str)
            if "formula_recommendations" in parsed:
                formulas = parsed["formula_recommendations"]
        except Exception as err:
            print(f"[LLM JSON Parse Note]: {err}, falling back to structured clinical rules.")

    # Fallback to structured clinical rules if LLM gateway did not return valid JSON
    if not formulas:
        all_text = f"{chief_complaint} {' '.join(patient_issues)} {' '.join([f.get('finding', '') for f in ai_diagnostics])}".upper()

        # ── CARDIOLOGY ──────────────────────────────────────────────────────────
        if _any_keyword(["ISCHEMIA", "MYOCARDIAL", "REPOLARIZATION", "ECG", "EKG", "ST-T", "ANGINA", "ACS", "STEMI", "NSTEMI"], all_text):
            formulas.append({
                "category": "Cardiology / Ischemic Heart Disease",
                "formula_name": "Dual Antiplatelet Formulation",
                "active_ingredients": "Aspirin (75mg) + Clopidogrel (75mg)",
                "class": "Antiplatelet / Antithrombotic",
                "dosage_guidance": "1 tablet PO QD after meals x 30 days",
                "clinical_rationale": "Evidence-based dual antiplatelet therapy for ACS, STEMI/NSTEMI, and myocardial ischemia risk reduction per ACC/ESC guidelines.",
                "safety_note": "Monitor for GI bleeding; co-prescribe PPI if GI risk is high."
            })
            formulas.append({
                "category": "Cardiology / Lipid Management",
                "formula_name": "High-Intensity Statin Formulation",
                "active_ingredients": "Atorvastatin Calcium (40–80mg)",
                "class": "HMG-CoA Reductase Inhibitor",
                "dosage_guidance": "1 tablet PO QHS x 30 days (long-term)",
                "clinical_rationale": "High-intensity statin for coronary plaque stabilization and secondary prevention per ACC/AHA guidelines.",
                "safety_note": "Monitor ALT/AST baseline; alert for myopathy/rhabdomyolysis."
            })
            formulas.append({
                "category": "Cardiology / Rate Control",
                "formula_name": "Cardioselective Beta-Blocker Formulation",
                "active_ingredients": "Metoprolol Succinate (25–50mg)",
                "class": "Beta-1 Selective Adrenergic Blocker",
                "dosage_guidance": "1 tablet PO OD (titrate as tolerated) x 30 days",
                "clinical_rationale": "Post-ACS mortality reduction and heart rate control per ESC guidelines.",
                "safety_note": "Avoid abrupt withdrawal; monitor heart rate and blood pressure."
            })

        if _any_keyword(["HEART FAILURE", "CARDIAC FAILURE", "HFrEF", "REDUCED EJECTION FRACTION", "PULMONARY EDEMA", "CARDIOMEGALY"], all_text):
            formulas.append({
                "category": "Cardiology / Heart Failure",
                "formula_name": "ACE Inhibitor Formulation",
                "active_ingredients": "Ramipril (5mg)",
                "class": "Angiotensin-Converting Enzyme Inhibitor",
                "dosage_guidance": "1 tablet PO OD (titrate to 10mg target) x long-term",
                "clinical_rationale": "Cornerstone therapy for HFrEF — reduces mortality and hospitalizations per ESC/ACC guidelines.",
                "safety_note": "Monitor potassium, renal function, and watch for dry cough; switch to ARB if cough occurs."
            })
            formulas.append({
                "category": "Cardiology / Heart Failure",
                "formula_name": "Loop Diuretic Formulation",
                "active_ingredients": "Furosemide (40mg)",
                "class": "Loop Diuretic",
                "dosage_guidance": "1 tablet PO OD-BID (dose by clinical response)",
                "clinical_rationale": "Volume overload decongestion in acute/chronic heart failure — symptom relief.",
                "safety_note": "Monitor serum electrolytes (K+, Mg2+) and renal function regularly."
            })
            formulas.append({
                "category": "Cardiology / Heart Failure",
                "formula_name": "Mineralocorticoid Receptor Antagonist",
                "active_ingredients": "Spironolactone (25mg)",
                "class": "Aldosterone Antagonist",
                "dosage_guidance": "1 tablet PO OD x long-term",
                "clinical_rationale": "Mortality reduction in HFrEF (EF ≤35%) per RALES trial evidence.",
                "safety_note": "Contraindicated in hyperkalemia (K+ > 5.0 mEq/L) or eGFR < 30."
            })

        if _any_keyword(["HYPERTENSION", "BLOOD PRESSURE", "BP HIGH", "ELEVATED BP", "HTN"], all_text):
            formulas.append({
                "category": "Cardiology / Hypertension",
                "formula_name": "ARB Antihypertensive Formulation",
                "active_ingredients": "Telmisartan (40mg)",
                "class": "Angiotensin Receptor Blocker",
                "dosage_guidance": "1 tablet PO QD, same time daily x 30 days",
                "clinical_rationale": "First-line agent for stage 1-2 essential hypertension and cardio-renal protection per JNC/ESH guidelines.",
                "safety_note": "Monitor serum potassium and renal function periodically."
            })
            formulas.append({
                "category": "Cardiology / Hypertension",
                "formula_name": "Calcium Channel Blocker Formulation",
                "active_ingredients": "Amlodipine Besylate (5mg)",
                "class": "Dihydropyridine Calcium Channel Blocker",
                "dosage_guidance": "1 tablet PO OD x 30 days",
                "clinical_rationale": "Combination antihypertensive especially effective in elderly patients and those of African descent (JNC8 recommendation).",
                "safety_note": "May cause ankle edema; take at consistent time daily."
            })

        if _any_keyword(["ATRIAL FIBRILLATION", "AF", "AFIB", "ARRHYTHMIA", "PALPITATION", "TACHYCARDIA", "SVT"], all_text):
            formulas.append({
                "category": "Cardiology / Arrhythmia",
                "formula_name": "Rate-Controlling Beta-Blocker Formulation",
                "active_ingredients": "Bisoprolol (2.5–5mg)",
                "class": "Cardioselective Beta-Blocker",
                "dosage_guidance": "1 tablet PO OD (titrate per heart rate target <80 bpm) x 30 days",
                "clinical_rationale": "First-line rate control in atrial fibrillation per AHA/ESC guidelines; reduces ventricular rate.",
                "safety_note": "Avoid in severe bradycardia, 2nd/3rd degree AV block, or severe asthma."
            })
            formulas.append({
                "category": "Cardiology / Anticoagulation",
                "formula_name": "Oral Anticoagulant (NOAC) Formulation",
                "active_ingredients": "Rivaroxaban (20mg) / Apixaban (5mg BD)",
                "class": "Direct Oral Anticoagulant (DOAC)",
                "dosage_guidance": "As per CHA₂DS₂-VASc score; Rivaroxaban 20mg PO OD with evening meal",
                "clinical_rationale": "Stroke prevention in non-valvular atrial fibrillation — preferred over warfarin per ESC guidelines.",
                "safety_note": "Assess bleeding risk (HAS-BLED score); caution with NSAIDs and renal impairment."
            })

        if _any_keyword(["DEEP VEIN THROMBOSIS", "DVT", "PULMONARY EMBOLISM", "PE", "VTE", "THROMBOEMBOLISM"], all_text):
            formulas.append({
                "category": "Hematology / Anticoagulation",
                "formula_name": "DOAC Anticoagulation for VTE Formulation",
                "active_ingredients": "Rivaroxaban (15mg BD x 21 days, then 20mg OD) OR Apixaban (10mg BD x 7 days, then 5mg BD)",
                "class": "Direct Oral Anticoagulant",
                "dosage_guidance": "Per VTE treatment protocol — initial loading then maintenance",
                "clinical_rationale": "Treatment and secondary prevention of DVT/PE — non-inferior to LMWH/warfarin with simpler dosing.",
                "safety_note": "Baseline renal function required; avoid with strong CYP3A4/P-gp inhibitors."
            })

        # ── RESPIRATORY ─────────────────────────────────────────────────────────
        if _any_keyword(["PNEUMONIA", "LUNG", "CONSOLIDATION", "EFFUSION", "CHEST X-RAY", "HRCT", "LOWER RESPIRATORY", "LRTI", "CAP"], all_text):
            formulas.append({
                "category": "Respiratory / Community-Acquired Pneumonia",
                "formula_name": "Aminopenicillin + Beta-Lactamase Inhibitor Formulation",
                "active_ingredients": "Amoxicillin (875mg) + Clavulanic Acid (125mg)",
                "class": "Penicillin-Class Antibiotic",
                "dosage_guidance": "1 tablet PO BID after meals x 7 days",
                "clinical_rationale": "First-line CAP empirical therapy for outpatients per IDSA/ATS 2019 guidelines.",
                "safety_note": "Complete full 7-day course; check penicillin allergy history."
            })
            formulas.append({
                "category": "Respiratory / Atypical Coverage",
                "formula_name": "Macrolide Atypical Pathogen Formulation",
                "active_ingredients": "Azithromycin (500mg)",
                "class": "Macrolide Antibiotic",
                "dosage_guidance": "1 tablet PO OD x 5 days (concurrent with beta-lactam for moderate CAP)",
                "clinical_rationale": "Covers atypical organisms (Mycoplasma, Chlamydophila, Legionella) in CAP.",
                "safety_note": "Avoid with QT-prolonging drugs; monitor ECG if cardiac history present."
            })
            formulas.append({
                "category": "Respiratory / Mucolytic",
                "formula_name": "Mucolytic Expectorant Formulation",
                "active_ingredients": "Acetylcysteine (600mg) / Ambroxol (75mg SR)",
                "class": "Mucolytic Agent",
                "dosage_guidance": "1 tablet/effervescent sachet PO BID x 5-7 days",
                "clinical_rationale": "Promotes airway clearance and reduces viscosity of bronchial secretions.",
                "safety_note": "Dissolve completely in water; adequate hydration enhances efficacy."
            })

        if _any_keyword(["ASTHMA", "COPD", "WHEEZE", "WHEEZING", "BREATHLESSNESS", "DYSPNEA", "BRONCHITIS", "CHRONIC OBSTRUCTIVE"], all_text):
            formulas.append({
                "category": "Respiratory / Acute Bronchodilation",
                "formula_name": "Short-Acting Beta-2 Agonist (SABA) Formulation",
                "active_ingredients": "Salbutamol / Albuterol (100mcg MDI)",
                "class": "Beta-2 Adrenergic Agonist",
                "dosage_guidance": "2 puffs Q4-6H PRN for breathlessness/wheeze (use spacer)",
                "clinical_rationale": "Rapid relief of acute bronchospasm in asthma/COPD exacerbation per GINA/GOLD guidelines.",
                "safety_note": "Overuse indicates poor control — escalate to controller therapy."
            })
            formulas.append({
                "category": "Respiratory / Inhaled Corticosteroid Controller",
                "formula_name": "ICS + LABA Combination Formulation",
                "active_ingredients": "Budesonide (200mcg) + Formoterol (6mcg) Turbuhaler",
                "class": "Inhaled Corticosteroid + Long-Acting Beta-2 Agonist",
                "dosage_guidance": "1-2 inhalations PO BID (maintenance) — max 8 inhalations/day incl. rescue",
                "clinical_rationale": "First-line controller for moderate-severe persistent asthma per GINA Step 3-4 guidelines.",
                "safety_note": "Rinse mouth after inhalation to prevent oral candidiasis."
            })
            formulas.append({
                "category": "Respiratory / COPD Maintenance",
                "formula_name": "Long-Acting Muscarinic Antagonist (LAMA) Formulation",
                "active_ingredients": "Tiotropium Bromide (18mcg HandiHaler)",
                "class": "Long-Acting Muscarinic Antagonist",
                "dosage_guidance": "1 capsule inhaled OD via HandiHaler device",
                "clinical_rationale": "GOLD guideline-recommended maintenance bronchodilator for COPD group B/C/D.",
                "safety_note": "Do not swallow capsule; avoid in narrow-angle glaucoma or BPH."
            })

        if _any_keyword(["TUBERCULOSIS", "TB", "AFB", "MANTOUX", "SPUTUM POSITIVE", "ACID-FAST BACILLI"], all_text):
            formulas.append({
                "category": "Infectious Disease / Anti-Tubercular",
                "formula_name": "First-Line Anti-Tubercular DOTS Combination",
                "active_ingredients": "Rifampicin (600mg) + Isoniazid (300mg) + Pyrazinamide (1500mg) + Ethambutol (1200mg) — FDC per weight band",
                "class": "Anti-Tubercular Therapy (ATT)",
                "dosage_guidance": "PO OD on empty stomach — 2 months intensive (RHZE) + 4 months continuation (RH) per WHO DOTS protocol",
                "clinical_rationale": "WHO-standard first-line DOTS regimen for drug-susceptible pulmonary and extrapulmonary TB.",
                "safety_note": "Baseline LFTs, uric acid, visual acuity required; notify public health TB program."
            })
            formulas.append({
                "category": "Infectious Disease / Pyridoxine Supplementation",
                "formula_name": "Pyridoxine (Vitamin B6) Supplementation",
                "active_ingredients": "Pyridoxine Hydrochloride (25mg)",
                "class": "Vitamin B6 Supplement",
                "dosage_guidance": "1 tablet PO OD throughout ATT course",
                "clinical_rationale": "Prevents isoniazid-induced peripheral neuropathy — mandatory co-prescription with INH-containing ATT.",
                "safety_note": "Doses > 200mg/day may paradoxically cause neuropathy; standard 25mg protective."
            })

        # ── ENDOCRINOLOGY ────────────────────────────────────────────────────────
        if _any_keyword(["GLUCOSE", "DIABETES", "HYPERGLYCEMIA", "HBA1C", "SUGAR", "DM TYPE 2", "T2DM", "FASTING SUGAR"], all_text):
            formulas.append({
                "category": "Endocrine / Antidiabetic — First Line",
                "formula_name": "Biguanide Glycemic Control Formulation",
                "active_ingredients": "Metformin Hydrochloride (500–1000mg)",
                "class": "Biguanide Antidiabetic Agent",
                "dosage_guidance": "500mg PO BID with meals; titrate to 1000mg BID over 4 weeks as tolerated",
                "clinical_rationale": "First-line T2DM agent per ADA/EASD guidelines — reduces hepatic glucose output, improves insulin sensitivity, weight-neutral.",
                "safety_note": "Contraindicated eGFR < 30; withhold 48h before contrast procedures; start low to minimize GI side effects."
            })
            formulas.append({
                "category": "Endocrine / Antidiabetic — SGLT2 Inhibitor",
                "formula_name": "SGLT2 Inhibitor Cardio-Renal Formulation",
                "active_ingredients": "Empagliflozin (10mg) / Dapagliflozin (10mg)",
                "class": "Sodium-Glucose Co-transporter-2 Inhibitor",
                "dosage_guidance": "1 tablet PO OD in the morning x long-term",
                "clinical_rationale": "Superior cardiovascular and renal outcomes in T2DM with established CVD or CKD per EMPA-REG, DECLARE trials.",
                "safety_note": "Withhold 3 days before major surgery; watch for DKA, UTI, genital fungal infection."
            })
            formulas.append({
                "category": "Endocrine / Antidiabetic — GLP-1 Agonist",
                "formula_name": "GLP-1 Receptor Agonist Formulation",
                "active_ingredients": "Semaglutide (0.5mg SC weekly) / Oral Semaglutide (7mg OD)",
                "class": "Glucagon-Like Peptide-1 Receptor Agonist",
                "dosage_guidance": "Start 0.25mg SC weekly x 4 weeks, then 0.5mg; oral: 7mg OD before first meal",
                "clinical_rationale": "Weight loss + glycemic control + CV risk reduction (SUSTAIN-6, LEADER trials) — preferred in obese T2DM with CVD.",
                "safety_note": "Contraindicated with personal/family history of medullary thyroid cancer or MEN2."
            })

        if _any_keyword(["HYPOTHYROID", "THYROID", "TSH HIGH", "HASHIMOTO", "MYXEDEMA"], all_text):
            formulas.append({
                "category": "Endocrine / Thyroid Replacement",
                "formula_name": "Levothyroxine Sodium Formulation",
                "active_ingredients": "Levothyroxine Sodium (25–100mcg; dose by TSH and weight)",
                "class": "Synthetic L-Thyroxine (T4)",
                "dosage_guidance": "PO OD on empty stomach, 30-60 min before breakfast; start low in elderly/cardiac patients",
                "clinical_rationale": "Standard thyroid hormone replacement for primary hypothyroidism — normalizes TSH per ATA guidelines.",
                "safety_note": "Recheck TSH in 6-8 weeks for dose titration; interactions with calcium, iron (separate by 4h)."
            })

        if _any_keyword(["HYPERTHYROID", "THYROTOXICOSIS", "GRAVES", "TSH LOW", "FREE T4 HIGH"], all_text):
            formulas.append({
                "category": "Endocrine / Antithyroid",
                "formula_name": "Thionamide Antithyroid Formulation",
                "active_ingredients": "Carbimazole (20–40mg) / Methimazole (15–30mg)",
                "class": "Thionamide Antithyroid Agent",
                "dosage_guidance": "Initial: Carbimazole 20mg PO BD; titrate per TFTs toward block-replace or titration protocol",
                "clinical_rationale": "First-line medical management of Graves' disease and hyperthyroidism per ETA/ATA guidelines.",
                "safety_note": "CRITICAL: Warn about agranulocytosis — instruct patient to report fever/sore throat immediately; check CBC if symptomatic."
            })

        if _any_keyword(["ADRENAL INSUFFICIENCY", "ADDISON", "CORTISOL LOW", "STEROID DEPENDENT"], all_text):
            formulas.append({
                "category": "Endocrine / Adrenal Replacement",
                "formula_name": "Glucocorticoid Replacement Formulation",
                "active_ingredients": "Hydrocortisone (10mg AM + 5mg noon + 5mg PM)",
                "class": "Glucocorticoid",
                "dosage_guidance": "PO in divided doses mimicking diurnal cortisol rhythm",
                "clinical_rationale": "Replacement therapy for primary/secondary adrenal insufficiency per Endocrine Society guidelines.",
                "safety_note": "Sick day rules mandatory — double/triple dose during intercurrent illness; carry steroid card."
            })

        if _any_keyword(["OSTEOPOROSIS", "LOW BONE DENSITY", "DEXA", "FRACTURE RISK", "MENOPAUSE", "T-SCORE"], all_text):
            formulas.append({
                "category": "Endocrine / Bone Health",
                "formula_name": "Bisphosphonate Bone Protection Formulation",
                "active_ingredients": "Alendronate Sodium (70mg once weekly)",
                "class": "Bisphosphonate",
                "dosage_guidance": "1 tablet PO once weekly on empty stomach with full glass of water — remain upright 30 min",
                "clinical_rationale": "First-line pharmacotherapy for osteoporosis and fracture risk reduction per NOF/NOGG guidelines.",
                "safety_note": "Contraindicated in esophageal stricture or inability to sit/stand; dental exam before initiation."
            })
            formulas.append({
                "category": "Endocrine / Calcium & Vitamin D",
                "formula_name": "Calcium + Vitamin D3 Supplementation",
                "active_ingredients": "Calcium Carbonate (1000mg) + Cholecalciferol D3 (800–2000 IU)",
                "class": "Mineral + Fat-Soluble Vitamin Supplement",
                "dosage_guidance": "1 tablet PO OD-BID with food (calcium best absorbed <500mg per dose)",
                "clinical_rationale": "Essential co-prescription with bisphosphonates for osteoporosis; corrects vitamin D deficiency worldwide.",
                "safety_note": "Separate calcium from bisphosphonate by 30 min; check baseline 25-OH vitamin D."
            })

        # ── GASTROENTEROLOGY ────────────────────────────────────────────────────
        if _any_keyword(["GASTRITIS", "GERD", "ACIDITY", "PEPTIC", "ULCER", "HEARTBURN", "REFLUX", "DYSPEPSIA", "H. PYLORI"], all_text):
            formulas.append({
                "category": "Gastroenterology / Acid Suppression",
                "formula_name": "Proton Pump Inhibitor Formulation",
                "active_ingredients": "Pantoprazole (40mg) / Omeprazole (20mg)",
                "class": "Proton Pump Inhibitor",
                "dosage_guidance": "1 tablet PO OD 30 min before breakfast x 4-8 weeks (longer for erosive esophagitis)",
                "clinical_rationale": "Most effective acid suppression for GERD, peptic ulcer disease, and H. pylori eradication per ACG guidelines.",
                "safety_note": "Avoid long-term without indication; risk of hypomagnesaemia and C. difficile with prolonged use."
            })
            if _any_keyword(["H. PYLORI", "HELICOBACTER", "UREA BREATH", "PEPTIC ULCER"], all_text):
                formulas.append({
                    "category": "Gastroenterology / H. pylori Eradication",
                    "formula_name": "Triple Therapy H. pylori Eradication Formulation",
                    "active_ingredients": "Omeprazole (20mg BD) + Clarithromycin (500mg BD) + Amoxicillin (1g BD)",
                    "class": "PPI + Macrolide + Amoxicillin Triple Regimen",
                    "dosage_guidance": "All three agents PO BD x 14 days (10-14 day courses preferred per ACG 2022)",
                    "clinical_rationale": "Standard clarithromycin-based triple therapy for H. pylori eradication per ACG/Maastricht V guidelines.",
                    "safety_note": "Check local clarithromycin resistance rates; confirm eradication 4 weeks post-therapy with UBT or stool antigen."
                })

        if _any_keyword(["DIARRHEA", "GASTROENTERITIS", "LOOSE MOTION", "VOMITING", "DEHYDRATION", "TRAVELER'S DIARRHEA"], all_text):
            formulas.append({
                "category": "Gastroenterology / Rehydration & Antiemetic",
                "formula_name": "Oral Rehydration & Antiemetic Formulation",
                "active_ingredients": "ORS (WHO low-osmolarity formula) + Ondansetron (4mg)",
                "class": "Electrolyte Rehydration + 5-HT3 Antagonist",
                "dosage_guidance": "ORS 200-400mL after every loose stool; Ondansetron 1 tablet Q8H PRN vomiting",
                "clinical_rationale": "WHO-recommended first-line management for acute gastroenteritis — prevents dehydration complications.",
                "safety_note": "Seek urgent care for bloody stool, high fever, or severe dehydration signs."
            })
            formulas.append({
                "category": "Gastroenterology / Gut Flora Restoration",
                "formula_name": "Probiotic Formulation",
                "active_ingredients": "Saccharomyces boulardii (250mg) / Lactobacillus + Bifidobacterium blend",
                "class": "Probiotic (Live Biotherapeutic Product)",
                "dosage_guidance": "1 capsule PO BID x 5-7 days (during and after antibiotic course if applicable)",
                "clinical_rationale": "Reduces duration of acute diarrhea and antibiotic-associated diarrhea per Cochrane meta-analysis evidence.",
                "safety_note": "Avoid in severely immunocompromised patients; refrigerate Lactobacillus-based products."
            })

        if _any_keyword(["CONSTIPATION", "BOWEL", "STRAINING", "HARD STOOL"], all_text):
            formulas.append({
                "category": "Gastroenterology / Constipation",
                "formula_name": "Osmotic + Bulking Laxative Formulation",
                "active_ingredients": "Lactulose (10g/15mL) OR Polyethylene Glycol 3350 (17g sachet)",
                "class": "Osmotic Laxative",
                "dosage_guidance": "Lactulose 15-30mL PO BD; or PEG 3350 1 sachet in 125mL water OD",
                "clinical_rationale": "Safe first-line osmotic laxative for functional constipation per ACG/BSG guidelines.",
                "safety_note": "Ensure adequate fluid intake; may cause bloating — titrate dose to response."
            })

        if _any_keyword(["HEPATITIS", "LIVER DISEASE", "CIRRHOSIS", "JAUNDICE", "HBsAg", "HCV", "ALT HIGH", "AST HIGH", "HEPATIC"], all_text):
            formulas.append({
                "category": "Hepatology / Liver Protection",
                "formula_name": "Hepatoprotective Formulation",
                "active_ingredients": "Silymarin (140mg) / Ursodeoxycholic Acid (300mg BD)",
                "class": "Hepatoprotective / Bile Acid Supplement",
                "dosage_guidance": "Silymarin 1 capsule PO TID; or UDCA 300mg PO BD with food",
                "clinical_rationale": "Liver cytoprotection in NAFLD/NASH, drug-induced hepatitis, and cholestatic disease — reduces hepatocellular inflammation.",
                "safety_note": "UDCA preferred for cholestatic conditions; not a substitute for specific hepatitis antiviral therapy."
            })
            if _any_keyword(["HEPATITIS B", "HBsAg POSITIVE", "HBV", "CHRONIC HEPATITIS B"], all_text):
                formulas.append({
                    "category": "Hepatology / Antiviral — HBV",
                    "formula_name": "Nucleoside Analogue Anti-HBV Formulation",
                    "active_ingredients": "Tenofovir Disoproxil Fumarate (300mg) / Entecavir (0.5mg)",
                    "class": "Nucleoside/Nucleotide Reverse Transcriptase Inhibitor",
                    "dosage_guidance": "1 tablet PO OD on empty stomach x long-term (per AASLD/EASL HBV treatment thresholds)",
                    "clinical_rationale": "First-line antiviral suppression for chronic HBV with high viral load, HBeAg-positive, or advanced fibrosis.",
                    "safety_note": "Monitor HBV DNA, LFTs, renal function; do not discontinue without specialist guidance."
                })

        if _any_keyword(["IRRITABLE BOWEL", "IBS", "ABDOMINAL CRAMPS", "COLITIS", "SPASTIC COLON"], all_text):
            formulas.append({
                "category": "Gastroenterology / IBS",
                "formula_name": "Antispasmodic Formulation",
                "active_ingredients": "Mebeverine (135mg) / Dicyclomine (20mg)",
                "class": "GI Smooth Muscle Antispasmodic",
                "dosage_guidance": "1 tablet PO TID 20 min before meals x 4 weeks",
                "clinical_rationale": "First-line symptomatic treatment for abdominal cramping and altered bowel habit in IBS per BSG/ACG guidelines.",
                "safety_note": "Safe in IBS-D and IBS-C; avoid Dicyclomine in narrow-angle glaucoma or BPH."
            })

        # ── INFECTIOUS DISEASE ──────────────────────────────────────────────────
        if _any_keyword(["MALARIA", "FALCIPARUM", "VIVAX", "PLASMODIUM", "SMEAR POSITIVE", "RDT POSITIVE"], all_text):
            formulas.append({
                "category": "Infectious Disease / Antimalarial",
                "formula_name": "Artemisinin Combination Therapy (ACT)",
                "active_ingredients": "Artemether (20mg) + Lumefantrine (120mg) — co-formulated tablet",
                "class": "Artemisinin-Based Combination Antimalarial",
                "dosage_guidance": "4 tablets PO BD x 3 days (at 0, 8, 24, 36, 48, 60 hours); weight-adjusted for children",
                "clinical_rationale": "WHO first-line ACT for uncomplicated falciparum malaria — superior efficacy and resistance profile.",
                "safety_note": "Take with fatty food for absorption; ECG monitoring if cardiac history; follow-up blood smear at day 3/7."
            })
            if _any_keyword(["VIVAX", "OVALE", "RELAPSING MALARIA", "RADICAL CURE"], all_text):
                formulas.append({
                    "category": "Infectious Disease / Antimalarial Radical Cure",
                    "formula_name": "Primaquine Radical Cure Formulation",
                    "active_ingredients": "Primaquine Phosphate (15mg base OD for P.vivax / 30mg base for P.ovale)",
                    "class": "8-Aminoquinoline Anti-relapse Agent",
                    "dosage_guidance": "15mg base PO OD x 14 days after chloroquine/ACT course",
                    "clinical_rationale": "Eliminates liver hypnozoites (radical cure) in P. vivax/P. ovale to prevent relapse per WHO guidelines.",
                    "safety_note": "MANDATORY G6PD testing before use — risk of severe haemolysis in G6PD deficiency."
                })

        if _any_keyword(["DENGUE", "DENGUE FEVER", "NS1 POSITIVE", "THROMBOCYTOPENIA", "PLATELET LOW"], all_text):
            formulas.append({
                "category": "Infectious Disease / Dengue Management",
                "formula_name": "Supportive Dengue Care Formulation",
                "active_ingredients": "Paracetamol / Acetaminophen (500–650mg) + ORS Rehydration",
                "class": "Antipyretic + Oral Rehydration",
                "dosage_guidance": "Paracetamol 650mg PO Q6H PRN for fever (max 3g/day); ORS 2-3L/day oral fluids",
                "clinical_rationale": "WHO dengue management guidelines — antipyretic and IV fluid management; NO NSAIDs/aspirin.",
                "safety_note": "AVOID aspirin and ibuprofen (bleeding risk); monitor platelet count daily; admit if warning signs present."
            })

        if _any_keyword(["HIV", "AIDS", "CD4", "ANTIRETROVIRAL", "ART", "VIRAL LOAD HIV"], all_text):
            formulas.append({
                "category": "Infectious Disease / Antiretroviral",
                "formula_name": "First-Line ART Combination Formulation",
                "active_ingredients": "Tenofovir (300mg) + Lamivudine (300mg) + Dolutegravir (50mg) — FDC (TLD)",
                "class": "NRTI Backbone + INSTI (Integrase Strand Transfer Inhibitor)",
                "dosage_guidance": "1 FDC tablet PO OD (preferably at night) x long-term — per national ART guidelines",
                "clinical_rationale": "WHO 2021 preferred first-line ART — high genetic barrier to resistance, well-tolerated, simplified dosing.",
                "safety_note": "Strict adherence critical (>95%); quarterly viral load monitoring; screen for HBV co-infection before TDF."
            })

        if _any_keyword(["SEPSIS", "SEPTICEMIA", "BACTEREMIA", "BLOOD CULTURE", "MULTIDRUG RESISTANT", "MDR"], all_text):
            formulas.append({
                "category": "Infectious Disease / Empirical Sepsis",
                "formula_name": "Broad-Spectrum Beta-Lactam Empirical Formulation",
                "active_ingredients": "Piperacillin (4g) + Tazobactam (0.5g) IV Q8H / Meropenem (1g IV Q8H) for MDR risk",
                "class": "Extended-Spectrum Penicillin + Beta-Lactamase Inhibitor / Carbapenem",
                "dosage_guidance": "IV administration — dose per renal function; refer to local antibiogram for empirical choice",
                "clinical_rationale": "Surviving Sepsis Campaign guideline-recommended empirical therapy for severe sepsis/septic shock within 1 hour of recognition.",
                "safety_note": "De-escalate based on culture results; ID/microbiology consultation essential; monitor renal and hepatic function."
            })

        if _any_keyword(["UTI", "URINARY TRACT", "DYSURIA", "BURNING MICTURITION", "URINE INFECTION", "CYSTITIS", "PYELONEPHRITIS"], all_text):
            formulas.append({
                "category": "Urology / Antibacterial",
                "formula_name": "Urinary Tract Antibacterial Formulation",
                "active_ingredients": "Nitrofurantoin (100mg MR) for uncomplicated / Ciprofloxacin (500mg BD) for complicated UTI",
                "class": "Urinary Antiseptic / Fluoroquinolone",
                "dosage_guidance": "Nitrofurantoin 100mg MR PO BD with food x 5 days; Ciprofloxacin 500mg BD x 7 days for complicated/male UTI",
                "clinical_rationale": "NICE/IDSA guideline-recommended empirical UTI therapy — nitrofurantoin preferred to preserve fluoroquinolone spectrum.",
                "safety_note": "Nitrofurantoin contraindicated eGFR < 30; urine culture before starting; check local resistance patterns."
            })

        if _any_keyword(["COVID", "SARS-COV-2", "COVID-19", "CORONAVIRUS", "PCR POSITIVE"], all_text):
            formulas.append({
                "category": "Infectious Disease / COVID-19",
                "formula_name": "Antiviral + Supportive COVID-19 Formulation",
                "active_ingredients": "Nirmatrelvir (150mg) + Ritonavir (100mg) [Paxlovid] / Molnupiravir (800mg BD) if high-risk",
                "class": "Oral Antiviral / 3CLpro Protease Inhibitor",
                "dosage_guidance": "Paxlovid: 2 tabs Nirmatrelvir + 1 tab Ritonavir PO BD x 5 days (start within 5 days of symptom onset)",
                "clinical_rationale": "WHO-recommended oral antiviral for high-risk non-hospitalized COVID-19 adults — 89% reduction in hospitalization (EPIC-HR).",
                "safety_note": "Check drug interactions (Ritonavir is a strong CYP3A4 inhibitor); contraindicated with simvastatin, rifampicin; eGFR adjust."
            })

        # ── NEUROLOGY ──────────────────────────────────────────────────────────
        if _any_keyword(["MIGRAINE", "HEADACHE", "CEPHALGIA", "HEMICRANIAL", "NAUSEA HEADACHE", "PHOTOPHOBIA"], all_text):
            formulas.append({
                "category": "Neurology / Migraine Abortive",
                "formula_name": "Triptan Migraine Abortive Formulation",
                "active_ingredients": "Sumatriptan (50mg oral / 6mg SC)",
                "class": "5-HT1B/1D Receptor Agonist (Triptan)",
                "dosage_guidance": "1 tablet PO at onset; may repeat after 2h (max 2 doses/24h); SC injection for severe attacks",
                "clinical_rationale": "First-line abortive therapy for moderate-severe migraine per AHS/EFNS guidelines.",
                "safety_note": "Contraindicated with ischemic heart disease, uncontrolled HTN, hemiplegic/basilar migraine; avoid >10 days/month (MOH risk)."
            })
            formulas.append({
                "category": "Neurology / Migraine Prophylaxis",
                "formula_name": "Beta-Blocker Migraine Prophylaxis Formulation",
                "active_ingredients": "Propranolol (40–80mg BD) / Topiramate (25–100mg OD at night)",
                "class": "Non-selective Beta-Blocker / Carbonic Anhydrase Inhibitor",
                "dosage_guidance": "Propranolol: start 40mg BD; titrate to 80mg BD; Topiramate: start 25mg OD, titrate monthly",
                "clinical_rationale": "First-line migraine prophylaxis — reduces attack frequency by ≥50% per NICE/AHS evidence.",
                "safety_note": "Propranolol avoid in asthma/bradycardia; Topiramate: teratogenic (contraception needed), word-finding side effects."
            })

        if _any_keyword(["EPILEPSY", "SEIZURE", "CONVULSION", "STATUS EPILEPTICUS", "EEG"], all_text):
            formulas.append({
                "category": "Neurology / Antiepileptic",
                "formula_name": "Broad-Spectrum Antiepileptic Formulation",
                "active_ingredients": "Sodium Valproate (200–400mg BD) / Levetiracetam (500mg BD)",
                "class": "Antiepileptic Drug (AED)",
                "dosage_guidance": "Levetiracetam 500mg PO BD (preferred — fewer interactions); Valproate 200mg BD titrated",
                "clinical_rationale": "First-line broad-spectrum AED for focal and generalized epilepsies per ILAE/NICE guidelines.",
                "safety_note": "Valproate ABSOLUTELY contraindicated in women of childbearing age (teratogenic); Levetiracetam preferred; never stop abruptly."
            })

        if _any_keyword(["PARKINSON", "TREMOR", "RIGIDITY", "BRADYKINESIA", "DOPAMINE"], all_text):
            formulas.append({
                "category": "Neurology / Parkinson's Disease",
                "formula_name": "Levodopa + Decarboxylase Inhibitor Formulation",
                "active_ingredients": "Levodopa (100mg) + Carbidopa (25mg) — standard-release",
                "class": "Dopamine Precursor + Peripheral Decarboxylase Inhibitor",
                "dosage_guidance": "Start 100/25mg PO TID; titrate every 1-2 weeks as tolerated (target: symptom control)",
                "clinical_rationale": "Most effective symptomatic therapy for Parkinson's disease per MDS/NICE guidelines.",
                "safety_note": "Take 30 min before meals; high-protein meals reduce absorption; monitor for dyskinesias and orthostatic hypotension."
            })

        if _any_keyword(["DEMENTIA", "ALZHEIMER", "COGNITIVE DECLINE", "MMSE LOW", "MEMORY LOSS"], all_text):
            formulas.append({
                "category": "Neurology / Dementia",
                "formula_name": "Acetylcholinesterase Inhibitor Formulation",
                "active_ingredients": "Donepezil (5mg → 10mg after 1 month)",
                "class": "Reversible Acetylcholinesterase Inhibitor",
                "dosage_guidance": "5mg PO OD at bedtime for 1 month, then increase to 10mg OD",
                "clinical_rationale": "Symptomatic cognitive enhancement in mild-moderate Alzheimer's dementia per NICE/AAN guidelines.",
                "safety_note": "GI side effects common (nausea, diarrhea) — take at bedtime; bradycardia risk in cardiac patients."
            })

        if _any_keyword(["STROKE", "CVA", "TIA", "CEREBROVASCULAR", "ISCHEMIC STROKE", "THROMBUS BRAIN"], all_text):
            formulas.append({
                "category": "Neurology / Secondary Stroke Prevention",
                "formula_name": "Antiplatelet + Statin Stroke Prevention Formulation",
                "active_ingredients": "Aspirin (75-100mg OD) + Atorvastatin (40-80mg OD) — or Clopidogrel if aspirin intolerant",
                "class": "Antiplatelet + HMG-CoA Reductase Inhibitor",
                "dosage_guidance": "Aspirin 100mg PO OD after food + Atorvastatin 40mg PO QHS — lifelong",
                "clinical_rationale": "AHA/ASA guideline-recommended dual secondary prevention after ischemic stroke/TIA — reduces recurrence by 25%.",
                "safety_note": "Confirm ischemic (not hemorrhagic) stroke before antiplatelet use; maintain BP < 130/80 mmHg."
            })

        if _any_keyword(["PERIPHERAL NEUROPATHY", "NEUROPATHY", "BURNING FEET", "TINGLING HANDS", "DIABETIC NEUROPATHY"], all_text):
            formulas.append({
                "category": "Neurology / Neuropathic Pain",
                "formula_name": "Neuropathic Pain Modulator Formulation",
                "active_ingredients": "Pregabalin (75mg BD) / Duloxetine (30–60mg OD)",
                "class": "Alpha-2-Delta Calcium Channel Ligand / SNRI",
                "dosage_guidance": "Pregabalin 75mg PO BD (titrate to 150mg BD); Duloxetine 30mg OD x 2 weeks then 60mg OD",
                "clinical_rationale": "First-line pharmacotherapy for diabetic peripheral neuropathy per AAN/EFNS guidelines.",
                "safety_note": "Pregabalin: renal dose adjustment; avoid abrupt withdrawal. Duloxetine: suicidality warning in first 4 weeks."
            })

        # ── PSYCHIATRY ─────────────────────────────────────────────────────────
        if _any_keyword(["ANXIETY", "GENERALISED ANXIETY", "GAD", "PANIC", "PANIC DISORDER"], all_text):
            formulas.append({
                "category": "Psychiatry / Anxiety Disorder",
                "formula_name": "SSRI Anxiolytic Formulation",
                "active_ingredients": "Escitalopram (10mg) / Sertraline (50mg)",
                "class": "Selective Serotonin Reuptake Inhibitor",
                "dosage_guidance": "Start 5mg OD x 1 week, then 10mg OD (Escitalopram); or Sertraline 25mg OD → 50mg after 1 week",
                "clinical_rationale": "First-line pharmacotherapy for GAD and panic disorder per NICE/WFSBP guidelines — superior long-term efficacy.",
                "safety_note": "Full effect in 4-6 weeks; do not discontinue abruptly (taper); serotonin syndrome risk with MAOIs."
            })

        if _any_keyword(["DEPRESSION", "MDD", "DEPRESSIVE DISORDER", "ANHEDONIA", "SUICIDAL IDEATION"], all_text):
            formulas.append({
                "category": "Psychiatry / Major Depressive Disorder",
                "formula_name": "SSRI/SNRI Antidepressant Formulation",
                "active_ingredients": "Sertraline (50–200mg OD) / Venlafaxine XR (75–225mg OD)",
                "class": "SSRI / Serotonin-Norepinephrine Reuptake Inhibitor",
                "dosage_guidance": "Sertraline 50mg OD (morning); titrate by 50mg every 2-4 weeks to max 200mg; Venlafaxine XR 75mg OD with food",
                "clinical_rationale": "First-line MDD treatment per APA/NICE — comparable efficacy across SSRIs; SNRIs preferred with comorbid pain.",
                "safety_note": "Suicide risk monitoring critical first 4 weeks; taper on discontinuation; drug interactions with MAOIs, tramadol."
            })

        if _any_keyword(["BIPOLAR", "MANIA", "MANIC EPISODE", "MOOD STABILIZER"], all_text):
            formulas.append({
                "category": "Psychiatry / Bipolar Disorder",
                "formula_name": "Mood Stabilizer Formulation",
                "active_ingredients": "Lithium Carbonate (400mg BD–TID, target serum level 0.6-0.8 mEq/L) / Valproate Sodium (500mg BD)",
                "class": "Mood Stabilizer",
                "dosage_guidance": "Lithium: titrate by serum levels (0.6-0.8 mEq/L maintenance); check at 5-7 days after each dose change",
                "clinical_rationale": "First-line long-term prophylaxis for bipolar disorder — reduces suicide risk per BAP/CANMAT guidelines.",
                "safety_note": "Lithium narrow therapeutic index — monthly serum monitoring; renal, thyroid monitoring 6-monthly; toxicity risk with dehydration/NSAIDs."
            })

        if _any_keyword(["SCHIZOPHRENIA", "PSYCHOSIS", "HALLUCINATION", "DELUSION", "PSYCHOTIC"], all_text):
            formulas.append({
                "category": "Psychiatry / Psychosis",
                "formula_name": "Atypical Antipsychotic Formulation",
                "active_ingredients": "Risperidone (2–6mg OD-BD) / Olanzapine (5–20mg OD at night)",
                "class": "Second-Generation (Atypical) Antipsychotic",
                "dosage_guidance": "Risperidone 2mg OD initially; titrate by 1mg weekly to optimal response; Olanzapine 5mg OD at night",
                "clinical_rationale": "First-line atypical antipsychotic for schizophrenia spectrum disorders per NICE/APA guidelines — better tolerability vs. typicals.",
                "safety_note": "Monitor metabolic parameters (weight, glucose, lipids) 3-monthly; EPS risk; cardiac QTc monitoring."
            })

        if _any_keyword(["INSOMNIA", "SLEEP DISORDER", "DIFFICULTY SLEEPING", "POOR SLEEP"], all_text):
            formulas.append({
                "category": "Psychiatry / Sleep Disorder",
                "formula_name": "Non-Benzodiazepine Hypnotic Formulation",
                "active_ingredients": "Melatonin (3–10mg) / Zopiclone (3.75–7.5mg) / Zolpidem (5–10mg)",
                "class": "Melatonin Receptor Agonist / Non-BZD Sedative Hypnotic",
                "dosage_guidance": "Melatonin 3mg PO OD 1h before sleep (preferred, safest); Zopiclone 3.75mg at bedtime PRN (short-term ≤4 weeks)",
                "clinical_rationale": "AASM/NICE guidelines recommend CBT-I first-line; pharmacotherapy preferred with non-BZD agents over BZDs.",
                "safety_note": "Avoid Z-drugs in elderly (fall risk); Zopiclone/Zolpidem max 4 weeks; dependence/tolerance risk — use minimum effective dose."
            })

        if _any_keyword(["ADHD", "ATTENTION DEFICIT", "HYPERACTIVITY"], all_text):
            formulas.append({
                "category": "Psychiatry / ADHD",
                "formula_name": "CNS Stimulant Formulation",
                "active_ingredients": "Methylphenidate (10–60mg/day) / Atomoxetine (40–100mg OD) for non-stimulant option",
                "class": "CNS Stimulant / Selective NE Reuptake Inhibitor",
                "dosage_guidance": "Methylphenidate 5mg BD-TID (titrate weekly); Atomoxetine 40mg OD x 2 weeks → 80mg OD",
                "clinical_rationale": "First-line pharmacotherapy for ADHD in adults and children per NICE/AAP guidelines.",
                "safety_note": "Controlled drug — assess for substance misuse history; monitor height/weight in children, BP/HR in adults."
            })

        # ── MUSCULOSKELETAL ─────────────────────────────────────────────────────
        if _any_keyword(["ARTHRITIS", "JOINT PAIN", "KNEE PAIN", "BACK PAIN", "MUSCLE PAIN", "MYALGIA", "SPRAIN", "INFLAMMATORY ARTHRITIS"], all_text):
            formulas.append({
                "category": "Musculoskeletal / Anti-inflammatory",
                "formula_name": "NSAID Analgesic Formulation",
                "active_ingredients": "Etoricoxib (60–90mg OD) / Naproxen (500mg BD) + Pantoprazole (40mg OD)",
                "class": "Selective COX-2 Inhibitor / Non-Selective NSAID + PPI Gastroprotection",
                "dosage_guidance": "Etoricoxib 60mg PO OD with food (preferred GI safety); OR Naproxen 500mg BD with PPI",
                "clinical_rationale": "First-line anti-inflammatory for acute MSK pain per NICE/EULAR guidelines — etoricoxib preferred for GI safety.",
                "safety_note": "Avoid with renal impairment, heart failure, or active peptic ulcer; CV risk assessment before COX-2 use."
            })

        if _any_keyword(["GOUT", "URIC ACID", "HYPERURICEMIA", "TOPHI", "PODAGRA"], all_text):
            formulas.append({
                "category": "Rheumatology / Gout",
                "formula_name": "Acute Gout Relief Formulation",
                "active_ingredients": "Colchicine (0.5mg BD-TID for acute flare) + Prednisolone (30–40mg OD x 5 days if NSAID contraindicated)",
                "class": "Tubulin-Binding Anti-inflammatory / Corticosteroid",
                "dosage_guidance": "Colchicine 0.5mg PO TID x 3-5 days for acute attack; low-dose colchicine preferred (lower GI toxicity)",
                "clinical_rationale": "EULAR/ACR first-line acute gout management — colchicine or NSAID within 12-24h of attack onset.",
                "safety_note": "Colchicine: dose-reduce in renal/hepatic impairment; fatal toxicity with ciclosporin/erythromycin; GI toxicity dose-limiting."
            })
            formulas.append({
                "category": "Rheumatology / Urate-Lowering",
                "formula_name": "Xanthine Oxidase Inhibitor Formulation",
                "active_ingredients": "Allopurinol (100mg → 300mg OD) / Febuxostat (40–80mg OD)",
                "class": "Xanthine Oxidase Inhibitor",
                "dosage_guidance": "Start Allopurinol 100mg OD after acute attack settles; titrate monthly to target serum urate < 360 μmol/L (< 6 mg/dL)",
                "clinical_rationale": "First-line urate-lowering therapy per EULAR/ACR 2020 guidelines — prevents recurrent gout flares and tophus formation.",
                "safety_note": "HLA-B*5801 testing recommended in Asian patients before allopurinol (severe hypersensitivity risk); start colchicine cover on initiation."
            })

        if _any_keyword(["RHEUMATOID ARTHRITIS", "RA", "SLE", "LUPUS", "PSORIATIC ARTHRITIS", "INFLAMMATORY JOINT"], all_text):
            formulas.append({
                "category": "Rheumatology / DMARD Therapy",
                "formula_name": "Disease-Modifying Antirheumatic Formulation (csDMARD)",
                "active_ingredients": "Methotrexate (7.5–25mg once weekly PO/SC) + Folic Acid (5mg once weekly, day after MTX)",
                "class": "Conventional Synthetic DMARD / Folate Antagonist",
                "dosage_guidance": "MTX 7.5mg PO once weekly; titrate by 2.5mg/month to 15-25mg/week target; Folic Acid 5mg next day",
                "clinical_rationale": "First-line DMARD for rheumatoid arthritis per EULAR/ACR guidelines — reduces joint damage and systemic inflammation.",
                "safety_note": "MANDATORY folic acid co-prescription; baseline and quarterly LFTs, CBC, creatinine; absolutely contraindicated in pregnancy."
            })

        # ── ALLERGY / IMMUNOLOGY ────────────────────────────────────────────────
        if _any_keyword(["ALLERGY", "ALLERGIC", "RHINITIS", "URTICARIA", "ITCHING", "SNEEZING", "HIVES", "ANGIOEDEMA"], all_text):
            formulas.append({
                "category": "Allergy / Antihistamine",
                "formula_name": "Second-Generation Non-Sedating Antihistamine",
                "active_ingredients": "Cetirizine (10mg) / Loratadine (10mg) / Fexofenadine (180mg)",
                "class": "H1 Antihistamine — Second Generation",
                "dosage_guidance": "1 tablet PO OD (cetirizine/loratadine) or OD (fexofenadine 180mg) x 7-14 days",
                "clinical_rationale": "ARIA guideline-recommended for allergic rhinitis and urticaria — non-sedating, once-daily dosing, effective.",
                "safety_note": "Cetirizine mild sedation — caution driving; Loratadine/Fexofenadine virtually non-sedating; safe in elderly."
            })
            if _any_keyword(["ASTHMA", "NASAL POLYPS", "SEVERE ALLERGY"], all_text):
                formulas.append({
                    "category": "Allergy / Intranasal Steroid",
                    "formula_name": "Intranasal Corticosteroid Formulation",
                    "active_ingredients": "Mometasone Furoate (50mcg/spray) / Fluticasone Propionate (50mcg/spray)",
                    "class": "Topical Intranasal Corticosteroid",
                    "dosage_guidance": "2 sprays per nostril OD (morning); onset of effect 12-24h; maximum benefit at 2 weeks",
                    "clinical_rationale": "Most effective treatment for moderate-severe allergic rhinitis per ARIA/EAACI guidelines — superior to oral antihistamines alone.",
                    "safety_note": "Avoid spraying toward nasal septum; epistaxis possible; very low systemic absorption at recommended doses."
                })

        if _any_keyword(["ANAPHYLAXIS", "ANAPHYLACTIC", "SEVERE ALLERGIC REACTION", "EPINEPHRINE"], all_text):
            formulas.append({
                "category": "Emergency / Anaphylaxis",
                "formula_name": "Epinephrine (Adrenaline) Autoinjector — Emergency",
                "active_ingredients": "Epinephrine / Adrenaline (0.3mg IM) — autoinjector",
                "class": "Alpha + Beta Adrenergic Agonist — Emergency Medication",
                "dosage_guidance": "0.3mg IM (anterolateral thigh) IMMEDIATELY — FIRST-LINE for anaphylaxis; repeat after 5-15 min if no response",
                "clinical_rationale": "ABSOLUTE first-line treatment for anaphylaxis per WAO/AAAAI guidelines — only proven life-saving intervention.",
                "safety_note": "ALWAYS prescribe autoinjector for at-risk patients; instruct on 2-injection carrying, self-administration technique, and EMERGENCY SERVICES call."
            })

        # ── DERMATOLOGY ─────────────────────────────────────────────────────────
        if _any_keyword(["CELLULITIS", "SKIN INFECTION", "ABSCESS", "WOUND INFECTION", "PYODERMA", "IMPETIGO", "ERYSIPELAS"], all_text):
            formulas.append({
                "category": "Dermatology / Skin & Soft Tissue Infection",
                "formula_name": "Cephalosporin Skin Infection Formulation",
                "active_ingredients": "Cephalexin (500mg QID) for mild / Cefalexin + Metronidazole for mixed infection",
                "class": "First-Generation Cephalosporin",
                "dosage_guidance": "500mg PO QID x 7 days for cellulitis; Flucloxacillin (500mg QID) preferred if MSSA likely",
                "clinical_rationale": "IDSA guideline-recommended first-line for non-purulent cellulitis — covers streptococcal/staphylococcal organisms.",
                "safety_note": "Fluctuant abscesses require I&D in addition to antibiotics; consider MRSA coverage if risk factors present."
            })

        if _any_keyword(["ECZEMA", "ATOPIC DERMATITIS", "PRURITIC RASH", "PSORIASIS", "RASH", "DERMATITIS"], all_text):
            formulas.append({
                "category": "Dermatology / Inflammatory Skin Disease",
                "formula_name": "Topical Corticosteroid Formulation",
                "active_ingredients": "Hydrocortisone 1% cream (mild) / Betamethasone Valerate 0.1% cream (moderate) / Mometasone 0.1% (moderate-potent)",
                "class": "Topical Glucocorticoid",
                "dosage_guidance": "Apply thin layer to affected area BD (mild) or OD (potent steroids) — use lowest effective potency",
                "clinical_rationale": "First-line treatment for atopic dermatitis and eczematous conditions per BAD/AAD guidelines.",
                "safety_note": "Avoid potent steroids on face/flexures/groin; do not use > 2 weeks on thin skin — risk of atrophy, striae."
            })

        if _any_keyword(["ACNE", "ACNE VULGARIS", "COMEDONE", "PIMPLE", "CYSTIC ACNE"], all_text):
            formulas.append({
                "category": "Dermatology / Acne",
                "formula_name": "Topical Retinoid + Antimicrobial Acne Formulation",
                "active_ingredients": "Adapalene 0.1% gel (nightly) + Benzoyl Peroxide 2.5% gel (morning) / Clindamycin 1% lotion",
                "class": "Retinoid + Antimicrobial Combination",
                "dosage_guidance": "Adapalene apply at night (pea-size); BPO 2.5% in AM; Doxycycline 100mg OD for moderate-severe inflammatory acne",
                "clinical_rationale": "Global Alliance evidence-based acne treatment — combination topical therapy is more effective than monotherapy.",
                "safety_note": "Adapalene causes initial purge/irritation (4-6 weeks); strict sun protection required; retinoids ABSOLUTELY contraindicated in pregnancy."
            })

        if _any_keyword(["FUNGAL INFECTION", "TINEA", "CANDIDA", "RINGWORM", "ONYCHOMYCOSIS", "JOCK ITCH", "ATHLETE'S FOOT"], all_text):
            formulas.append({
                "category": "Dermatology / Antifungal",
                "formula_name": "Topical + Oral Antifungal Formulation",
                "active_ingredients": "Clotrimazole 1% cream (topical) / Terbinafine (250mg OD oral for nail/extensive infection)",
                "class": "Azole Antifungal / Allylamine Antifungal",
                "dosage_guidance": "Clotrimazole cream BD x 4 weeks for skin tinea; Terbinafine 250mg PO OD x 6 weeks (fingers) / 12 weeks (toes) for onychomycosis",
                "clinical_rationale": "First-line antifungal for dermatophytosis per ISHAM/BAD guidelines — terbinafine superior cure rates in onychomycosis.",
                "safety_note": "Baseline LFTs before oral terbinafine; avoid in liver disease; avoid occlusive dressings with topical antifungals."
            })

        # ── UROLOGY / NEPHROLOGY ────────────────────────────────────────────────
        if _any_keyword(["KIDNEY DISEASE", "CKD", "RENAL FAILURE", "PROTEINURIA", "CREATININE HIGH", "NEPHROTIC", "NEPHRITIS"], all_text):
            formulas.append({
                "category": "Nephrology / CKD Renoprotection",
                "formula_name": "RAAS Blockade Renoprotection Formulation",
                "active_ingredients": "Ramipril (5–10mg OD) / Olmesartan (20–40mg OD) if ACEi intolerant",
                "class": "ACE Inhibitor / ARB",
                "dosage_guidance": "Ramipril 5mg OD (start 2.5mg if eGFR < 60); titrate to 10mg with BP and proteinuria monitoring",
                "clinical_rationale": "KDIGO guideline-recommended first-line renoprotection in CKD with proteinuria — reduces progression to ESRD.",
                "safety_note": "Monitor potassium and creatinine at 2 weeks after initiation; do NOT combine ACEi + ARB (harmful); stop if K+ > 5.5."
            })

        if _any_keyword(["BPH", "BENIGN PROSTATIC HYPERPLASIA", "URINARY RETENTION", "WEAK STREAM", "NOCTURIA", "LUTS"], all_text):
            formulas.append({
                "category": "Urology / BPH / LUTS",
                "formula_name": "Alpha-1 Adrenergic Blocker + 5-Alpha Reductase Inhibitor",
                "active_ingredients": "Tamsulosin (0.4mg OD) / Silodosin (8mg OD) + Finasteride (5mg OD) for large prostate",
                "class": "Alpha-1 Selective Adrenergic Blocker + 5-Alpha Reductase Inhibitor",
                "dosage_guidance": "Tamsulosin 0.4mg PO OD 30 min after same meal daily; Finasteride 5mg OD for prostate > 40g",
                "clinical_rationale": "EAU/AUA guideline-recommended combination for moderate-severe LUTS with enlarged prostate — reduces retention and surgery risk.",
                "safety_note": "Tamsulosin: first-dose orthostatic hypotension — start at night; Finasteride: PSA is halved (multiply by 2 for true PSA), teratogenic."
            })

        if _any_keyword(["ERECTILE DYSFUNCTION", "ED", "IMPOTENCE", "SEXUAL DYSFUNCTION"], all_text):
            formulas.append({
                "category": "Urology / Erectile Dysfunction",
                "formula_name": "PDE-5 Inhibitor Formulation",
                "active_ingredients": "Sildenafil (50mg) / Tadalafil (10mg on-demand or 5mg OD for daily use)",
                "class": "Phosphodiesterase-5 Inhibitor",
                "dosage_guidance": "Sildenafil 50mg PO 1h before activity PRN (max 100mg/day); Tadalafil 5mg OD for regular use",
                "clinical_rationale": "First-line pharmacotherapy for erectile dysfunction per EAU/AUA guidelines — ~70% efficacy across etiologies.",
                "safety_note": "ABSOLUTE contraindication with any nitrate formulation; caution with alpha-blockers (hypotension); avoid in unstable angina."
            })

        # ── HEMATOLOGY ──────────────────────────────────────────────────────────
        if _any_keyword(["ANEMIA", "LOW HEMOGLOBIN", "HB LOW", "IRON DEFICIENCY", "PALLOR", "FATIGUE HB"], all_text):
            formulas.append({
                "category": "Hematology / Iron Deficiency Anemia",
                "formula_name": "Oral Iron Replacement Formulation",
                "active_ingredients": "Ferrous Ascorbate (100mg elemental iron) + Folic Acid (1.5mg)",
                "class": "Oral Iron Supplement + Folate",
                "dosage_guidance": "1 tablet PO OD-BD after food (BD if Hb < 8 g/dL) x minimum 3 months post-correction",
                "clinical_rationale": "First-line for iron deficiency anemia — restores iron stores and hemoglobin per BSH/WHO guidelines.",
                "safety_note": "Dark stools expected (iron effect); GI intolerance — try alternate-day dosing; IV iron if oral fails or malabsorption."
            })

        if _any_keyword(["B12 DEFICIENCY", "VITAMIN B12 LOW", "MEGALOBLASTIC", "SUBACUTE COMBINED DEGENERATION", "HOMOCYSTEINE"], all_text):
            formulas.append({
                "category": "Hematology / Vitamin B12 Deficiency",
                "formula_name": "Cyanocobalamin / Methylcobalamin Formulation",
                "active_ingredients": "Methylcobalamin (1500mcg OD oral) / Cyanocobalamin (1mg IM monthly for malabsorption)",
                "class": "Vitamin B12 Supplement",
                "dosage_guidance": "Oral: 1500mcg PO OD x 3 months, then maintenance; IM: 1mg hydroxycobalamin every 3 months (for pernicious anemia/malabsorption)",
                "clinical_rationale": "Corrects megaloblastic anemia and prevents irreversible neurological damage (SCD) per BSH guidelines.",
                "safety_note": "Oral adequate if dietary deficiency; IM mandatory for pernicious anemia (intrinsic factor deficiency); confirm folate status concurrently."
            })

        # ── OPHTHALMOLOGY ───────────────────────────────────────────────────────
        if _any_keyword(["GLAUCOMA", "INTRAOCULAR PRESSURE", "IOP HIGH", "OPTIC NERVE", "VISUAL FIELD"], all_text):
            formulas.append({
                "category": "Ophthalmology / Glaucoma",
                "formula_name": "Prostaglandin Analogue IOP-Lowering Formulation",
                "active_ingredients": "Latanoprost 0.005% eye drops / Timolol 0.5% eye drops (beta-blocker alternative)",
                "class": "Prostaglandin Analogue / Topical Beta-Blocker",
                "dosage_guidance": "Latanoprost 1 drop in affected eye(s) QHS; Timolol 0.5% 1 drop BD (avoid in asthma/bradycardia)",
                "clinical_rationale": "EGS/AAO guideline first-line IOP reduction in primary open-angle glaucoma and ocular hypertension.",
                "safety_note": "Latanoprost: iris/eyelash color change; refrigerate unopened; Timolol: systemic absorption — contraindicated in asthma, bradycardia."
            })

        if _any_keyword(["CONJUNCTIVITIS", "RED EYE", "EYE INFECTION", "PINK EYE", "PURULENT EYE DISCHARGE"], all_text):
            formulas.append({
                "category": "Ophthalmology / Conjunctivitis",
                "formula_name": "Topical Antibiotic Eye Drop Formulation",
                "active_ingredients": "Ciprofloxacin 0.3% eye drops / Chloramphenicol 0.5% eye drops",
                "class": "Topical Fluoroquinolone / Broad-Spectrum Antibiotic Eye Drop",
                "dosage_guidance": "1-2 drops in affected eye(s) Q4-6H x 5-7 days (bacterial conjunctivitis)",
                "clinical_rationale": "First-line treatment for bacterial conjunctivitis per AAO/RCOphth guidelines — shortens duration and reduces spread.",
                "safety_note": "Viral conjunctivitis is self-limiting — antibiotics not indicated; wash hands, avoid contact lens use during treatment."
            })

        if _any_keyword(["DRY EYES", "DRY EYE SYNDROME", "KERATOCONJUNCTIVITIS SICCA", "SJÖGREN"], all_text):
            formulas.append({
                "category": "Ophthalmology / Dry Eye",
                "formula_name": "Ocular Lubricant Formulation",
                "active_ingredients": "Carboxymethylcellulose (CMC) 0.5% eye drops / Sodium Hyaluronate 0.1% eye drops",
                "class": "Artificial Tear / Ocular Lubricant",
                "dosage_guidance": "1-2 drops in each eye Q4-6H PRN (preservative-free preferred for > 4x/day use)",
                "clinical_rationale": "TFOS DEWS II recommended first-line therapy for dry eye disease — relieves symptoms and protects ocular surface.",
                "safety_note": "Preservative-free formulations preferred for frequent use; contact lens wearers should wait 15 min after instillation."
            })

        # ── ONCOLOGY SUPPORTIVE ─────────────────────────────────────────────────
        if _any_keyword(["CANCER", "CHEMOTHERAPY", "NAUSEA CHEMO", "ONCOLOGY", "TUMOR", "MALIGNANCY"], all_text):
            formulas.append({
                "category": "Oncology Supportive / Antiemetic",
                "formula_name": "5-HT3 + NK1 Antagonist Antiemetic Formulation",
                "active_ingredients": "Ondansetron (8mg IV/PO) + Dexamethasone (8mg IV/PO) ± Aprepitant (125mg day 1, 80mg days 2-3)",
                "class": "5-HT3 Antagonist + Corticosteroid + NK1 Receptor Antagonist",
                "dosage_guidance": "Ondansetron 8mg IV 30 min before chemo + Dexamethasone 8mg IV; Aprepitant 125mg PO day 1 for highly emetogenic regimens",
                "clinical_rationale": "ASCO/MASCC guideline-recommended triple antiemetic prophylaxis for moderately/highly emetogenic chemotherapy.",
                "safety_note": "Ondansetron QTc prolongation — ECG monitoring with high doses; Aprepitant CYP3A4 interactions with warfarin, dexamethasone."
            })
            formulas.append({
                "category": "Oncology Supportive / Pain Management",
                "formula_name": "WHO Analgesic Ladder Step 3 Formulation",
                "active_ingredients": "Morphine Sulfate IR (5–10mg Q4H oral) / Oxycodone CR (10–20mg Q12H) for cancer pain",
                "class": "Strong Opioid Analgesic",
                "dosage_guidance": "Morphine 5mg PO Q4H (opioid-naïve); titrate by 30-50% every 24h to adequate pain control; add breakthrough: 1/6 of total daily dose Q1H PRN",
                "clinical_rationale": "WHO analgesic ladder Step 3 for moderate-severe cancer pain — morphine remains WHO essential medicine gold standard.",
                "safety_note": "Co-prescribe regular laxative (lactulose/senna); tolerance and physical dependence expected — not to be confused with addiction; respiratory depression risk."
            })

        # ── ENT ─────────────────────────────────────────────────────────────────
        if _any_keyword(["SINUSITIS", "OTITIS", "EAR PAIN", "SORE THROAT", "PHARYNGITIS", "TONSILLITIS", "LARYNGITIS"], all_text):
            formulas.append({
                "category": "ENT / Upper Respiratory Infection",
                "formula_name": "Macrolide ENT Antibacterial Formulation",
                "active_ingredients": "Azithromycin (500mg OD x 3 days) / Amoxicillin-Clavulanate (875/125mg BD x 10 days) for sinusitis",
                "class": "Macrolide / Aminopenicillin+BLI",
                "dosage_guidance": "Azithromycin 500mg OD x 3 days; Amoxicillin-Clavulanate preferred for sinusitis per IDSA guidelines",
                "clinical_rationale": "Empirical antibacterial coverage for bacterial otitis media, sinusitis, tonsillopharyngitis per IDSA/NICE guidelines.",
                "safety_note": "Most acute pharyngitis is viral — antibiotic only for streptococcal (positive rapid antigen or high clinical score); reduce resistance."
            })

        # ── OBSTETRICS / GYNAECOLOGY ────────────────────────────────────────────
        if _any_keyword(["PREGNANCY", "ANTENATAL", "PRENATAL", "FIRST TRIMESTER", "GESTATIONAL DIABETES", "PREECLAMPSIA"], all_text):
            formulas.append({
                "category": "Obstetrics / Antenatal Supplements",
                "formula_name": "Antenatal Micronutrient Supplementation",
                "active_ingredients": "Folic Acid (5mg OD preconception → 400mcg from week 12) + Iron (60mg elemental OD) + Calcium (1000mg OD from week 20)",
                "class": "Essential Antenatal Micronutrient Supplement",
                "dosage_guidance": "Folic acid from pre-conception through 1st trimester; iron from 12-16 weeks; calcium from 20 weeks — WHO ANC guidelines",
                "clinical_rationale": "WHO-recommended antenatal supplementation — prevents neural tube defects, IDA, and gestational hypertension.",
                "safety_note": "Separate iron and calcium by 2h (absorption competition); constipation from iron — ensure adequate fiber intake."
            })

        if _any_keyword(["PCOS", "POLYCYSTIC OVARY", "IRREGULAR PERIODS", "ANOVULATION", "HYPERANDROGENISM"], all_text):
            formulas.append({
                "category": "Gynaecology / PCOS",
                "formula_name": "PCOS Metabolic Management Formulation",
                "active_ingredients": "Metformin (500mg BD–1500mg OD) + Inositol (Myo-inositol 4g + D-chiro-inositol 100mg) supplement",
                "class": "Biguanide + Insulin Sensitizer",
                "dosage_guidance": "Metformin 500mg BD with food x 3-6 months (titrate per tolerance); Myo-inositol 2g PO BD",
                "clinical_rationale": "ESHRE/ASRM guideline-recommended insulin sensitizer for PCOS — improves ovulation rate, metabolic parameters, and androgen levels.",
                "safety_note": "Combined OCP for androgen symptoms/cycle regulation; Clomifene/Letrozole for ovulation induction if fertility desired."
            })

        # ── PAEDIATRICS ─────────────────────────────────────────────────────────
        if _any_keyword(["PAEDIATRIC", "PEDIATRIC", "CHILD DOSE", "FEBRILE SEIZURE", "CHILD FEVER", "KAWASAKI"], all_text):
            formulas.append({
                "category": "Paediatrics / Antipyretic",
                "formula_name": "Paediatric Antipyretic Formulation",
                "active_ingredients": "Paracetamol Syrup (120mg/5mL) — 15mg/kg per dose; Ibuprofen Suspension (100mg/5mL) — 5-10mg/kg/dose",
                "class": "Analgesic/Antipyretic — Age-Appropriate Paediatric Formulation",
                "dosage_guidance": "Paracetamol: 15mg/kg Q6H PRN (max 4 doses/24h); Ibuprofen: 5-10mg/kg Q8H PRN (≥3 months, with food)",
                "clinical_rationale": "WHO/NICE paediatric antipyretic guidelines — alternate agents every 4-6h for refractory fever if needed.",
                "safety_note": "NEVER use aspirin in children < 16y (Reye's syndrome); Ibuprofen avoid in dehydration, renal disease; weight-based dosing critical."
            })

        # ── FEVER / VIRAL ────────────────────────────────────────────────────────
        if _any_keyword(["FEVER", "VIRAL", "FLU", "INFLUENZA", "COLD", "COUGH", "URI", "COMMON COLD", "VIRAL FEVER"], all_text):
            formulas.append({
                "category": "General / Antipyretic & Viral URI",
                "formula_name": "Antipyretic + Antitussive Formulation",
                "active_ingredients": "Paracetamol (650mg) + Cetirizine (5mg) + Dextromethorphan (15mg) — combination",
                "class": "Antipyretic / Second-Gen Antihistamine / Antitussive",
                "dosage_guidance": "1 tablet PO Q8H PRN x 3-5 days; paracetamol can be given independently at 650mg Q6H",
                "clinical_rationale": "Symptomatic relief for viral URTI — WHO evidence-based; no antibiotic needed for uncomplicated viral fever/cold.",
                "safety_note": "Hydration critical (3L/day); max paracetamol 4g/24h; avoid DXM in young children < 6 years."
            })

        if not formulas:
            formulas.append({
                "category": "General / Symptomatic Management",
                "formula_name": "Universal Antipyretic & Analgesic Formulation",
                "active_ingredients": "Paracetamol / Acetaminophen (500–650mg)",
                "class": "Analgesic & Antipyretic — WHO Essential Medicine",
                "dosage_guidance": "500-650mg PO Q6-8H PRN (max 4g/day adults; reduce to 2g/day in hepatic disease)",
                "clinical_rationale": "Universal first-line symptomatic analgesic/antipyretic across all clinical presentations per WHO Essential Medicines List.",
                "safety_note": "Safest OTC analgesic globally — do not exceed 4g/day; caution with alcohol/liver disease; check for paracetamol in other combination products."
            })

    print("AI FORMULA RECOMMENDATIONS PRODUCED:")
    for idx, f in enumerate(formulas, 1):
        print(f"  {idx}. [{f.get('category')}] {f.get('formula_name')} -> {f.get('active_ingredients')}")
    print("=" * 76 + "\n")

    return envelope(
        {
            "formula_recommendations": formulas
        },
        agent="AI Formulary Guidance",
        needs_approval=False,
        source=_source(),
        citations=["Evidence-Based Clinical Pharmacology & Formulary Guidelines"],
    )


# ---------------------------------------------------------------------------- Translation Agent
def translate_agent(text: str, target_language: str) -> dict[str, Any]:
    """Translate clinical text (e.g. a SOAP note or transcript) for a doctor to read in a
    language other than the one it was written/spoken in — e.g. so a doctor can explain an
    English SOAP note back to a patient in Hindi/Tamil/etc., or read a non-English transcript.
    This is a REFERENCE-ONLY view: it never changes the underlying approved clinical record,
    which always stays in the language it was actually authored/approved in.

    Returns {"translated_text": str, "translated": bool} — translated=False (with the original
    text echoed back) if no LLM is reachable, since offline machine translation isn't part of
    this project's deterministic fallback engine."""
    text = (text or "").strip()
    if not text:
        return {"translated_text": "", "translated": False}

    system = (
        "You are a medical translator. Translate the given clinical text accurately and "
        "naturally into the requested target language. Preserve clinical meaning exactly — "
        "do not add, remove, or infer any information. Return ONLY the translated text, with "
        "no preamble, quotes, or explanation."
    )
    prompt = f"Target language: {target_language}\n\nText to translate:\n{text}"
    translated = gateway.generate(prompt, system=system, temperature=0.1)
    if translated:
        return {"translated_text": translated.strip(), "translated": True}
    return {"translated_text": text, "translated": False}



