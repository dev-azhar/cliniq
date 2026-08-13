"""End-to-end smoke test — walks the full patient journey via the in-process API.

Run:  python -m scripts.smoke   (from the backend/ directory, venv active)
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ok = 0
fail = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global ok, fail
    mark = "PASS" if condition else "FAIL"
    if condition:
        ok += 1
    else:
        fail += 1
    print(f"  [{mark}] {label}{('  — ' + detail) if detail and not condition else ''}")


print("\n=== ClinIQ — end-to-end journey smoke test ===\n")

# 1) Check-in with ABHA
r = client.post("/api/v1/checkin", json={"abha_number": "91-2345-6789-0123", "channel": "WHATSAPP",
                                         "reason": "Fever and cough"})
check("Check-in (ABHA)", r.status_code == 200, r.text)
data = r.json()
patient_id = data["patient"]["patient_id"]
encounter_id = data["encounter_id"]
check("Existing patient matched", data["new_patient"] is False)

# 2) Consent
r = client.post("/api/v1/consent", json={"patient_id": patient_id, "purpose": "CARE_MGMT", "hours": 24})
check("Consent granted", r.status_code == 200 and r.json()["status"] == "GRANTED", r.text)

# 3) Patient 360
r = client.get(f"/api/v1/patients/{patient_id}/patient360")
p360 = r.json()
check("Patient 360 assembled", r.status_code == 200, r.text)
check("Allergy surfaced (Penicillin)", any("Penicillin" in a["substance"] for a in p360["allergies"]))
check("Active meds present", len(p360["active_medications"]) >= 1)

# 4) Triage
r = client.post(f"/api/v1/encounters/{encounter_id}/triage", json={
    "encounter_id": encounter_id, "symptom_text": "Fever and cough for 3 days, mild breathlessness",
    "duration": "3 days",
    "vitals": {"bp_systolic": 128, "bp_diastolic": 82, "spo2": 97, "heart_rate": 96, "temperature": 101.2},
})
tri = r.json()
check("Triage completed", r.status_code == 200, r.text)
check("Acuity assigned", bool(tri["triage"]["result"]["acuity_level"]))
check("Token issued", bool(tri["token"]["number"]))
check("Routed to specialty", tri["triage"]["result"]["specialty"] in ("General Medicine", "Pulmonology"))

# 5) Ambient SOAP
r = client.post(f"/api/v1/encounters/{encounter_id}/ambient", json={
    "encounter_id": encounter_id,
    "transcript": "Patient has fever and productive cough for three days with mild breathlessness. "
                  "On exam scattered crepitations in the chest.",
})
amb = r.json()
check("Ambient SOAP drafted", r.status_code == 200 and "soap" in amb["result"], r.text)
note_id = amb["note_id"]
check("SOAP needs approval (human-in-loop)", amb["needs_approval"] is True)

# 6) Approve note
r = client.post(f"/api/v1/notes/{note_id}/approve", json={
    "final_text": amb["result"]["draft_text"], "icd10_codes": amb["result"]["icd10"], "approved_by": "Dr. Mehta"})
check("Note approved", r.status_code == 200 and r.json()["status"] == "APPROVED", r.text)

# 7) Lab orders + results
r = client.post("/api/v1/lab-orders", json={"encounter_id": encounter_id, "tests": ["CBC", "CRP"]})
lab = r.json()
check("Lab orders created (+QR +bill)", r.status_code == 200 and len(lab["orders"]) == 2, r.text)
abnormal_seen = False
for o in lab["orders"]:
    rr = client.post(f"/api/v1/lab-orders/{o['lab_order_id']}/publish-result")
    if rr.status_code == 200 and rr.json()["result"]["abnormal"]:
        abnormal_seen = True
check("Lab AI flagged abnormal (CRP/WBC)", abnormal_seen)

# 8) Prescription — allergy BLOCK path
r = client.post("/api/v1/prescriptions", json={
    "encounter_id": encounter_id, "items": [{"drug_name": "Amoxicillin 500mg", "dose": "500 mg", "frequency": "1-0-1"}]})
rx_blocked = r.json()
check("CDS blocks penicillin (allergy)", rx_blocked["result"]["block"] is True, r.text)

# 9) Prescription — safe path + approve
r = client.post("/api/v1/prescriptions", json={
    "encounter_id": encounter_id,
    "items": [{"drug_name": "Azithromycin 500mg", "dose": "500 mg", "frequency": "1-0-0", "duration_days": 3, "quantity": 3},
              {"drug_name": "Paracetamol 650mg", "dose": "650 mg", "frequency": "SOS", "quantity": 10}]})
rx = r.json()
check("Safe Rx passes CDS", rx["result"]["block"] is False, r.text)
rx_id = rx["rx_id"]
r = client.post(f"/api/v1/prescriptions/{rx_id}/approve", json={"approved_by": "Dr. Mehta"})
check("Rx approved & e-signed", r.status_code == 200 and r.json()["status"] == "APPROVED", r.text)

# 10) Billing + payment
r = client.get(f"/api/v1/encounters/{encounter_id}/invoice")
inv = r.json()
check("Invoice aggregated (consult+lab+pharmacy)", inv["total"] > 0, r.text)
r = client.post(f"/api/v1/invoices/{inv['invoice_id']}/pay", json={"method": "UPI"})
check("Payment completed", r.status_code == 200 and r.json()["status"] == "PAID", r.text)

# 11) Discharge + compliance
r = client.put(f"/api/v1/encounters/{encounter_id}/discharge")
dis = r.json()
check("Discharged with PHR bundle", r.status_code == 200 and dis["status"] == "DISCHARGED", r.text)
check("Compliance complete (no gaps)", dis["compliance"]["result"]["complete"] is True,
      str(dis["compliance"]["result"]["gaps"]))

# 12) Command center
r = client.get("/api/v1/command-center/metrics")
cc = r.json()
check("Command Center metrics", r.status_code == 200 and "headline" in cc, r.text)

# 13) AI status
r = client.get("/api/v1/ai/status")
check("AI status endpoint", r.status_code == 200)
print(f"\n  AI mode: {r.json()['mode']}  ·  {r.json()['message']}")

# 14) Realtime WebSocket handshake (live event delivery is validated against the running server)
try:
    with client.websocket_connect("/ws/stream") as ws:
        hello = ws.receive_json()
        check("WebSocket handshake", hello["topic"] == "hello", str(hello))
except Exception as e:  # noqa: BLE001
    check("WebSocket handshake", False, repr(e))

print(f"\n=== {ok} passed, {fail} failed ===\n")
raise SystemExit(1 if fail else 0)
