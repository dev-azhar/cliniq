import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Mic, FlaskConical, Pill, ArrowLeft, Sparkles, History } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useJourney } from "../../lib/store";
import { LiveDot } from "../../components/ui";

import DoctorQueue from "./components/DoctorQueue";
import Patient360 from "./components/Patient360";
import AmbientSoap from "./components/AmbientSoap";
import OrdersAndLabs from "./components/OrdersAndLabs";
import Prescription from "./components/Prescription";
import CopilotSidepane from "./components/CopilotSidepane";

const TABS = [
  { id: "p360", label: "Patient 360", icon: FileText },
  { id: "soap", label: "Ambient SOAP", icon: Mic },
  { id: "labs", label: "Orders & Labs", icon: FlaskConical },
  { id: "rx", label: "Prescription", icon: Pill },
] as const;

export default function DoctorWorkspace() {
  const journey = useJourney();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("p360");
  
  const [sel, setSel] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Hoisted prescription state
  const [rxItems, setRxItems] = useState<any[]>([]);
  const [cds, setCds] = useState<any>(null);
  const [rxId, setRxId] = useState<string | null>(null);
  const [rxBusy, setRxBusy] = useState(false);
  const [rxAccept, setRxAccept] = useState(false);
  const [rxOverride, setRxOverride] = useState(false);
  const [rxDone, setRxDone] = useState<any>(null);
  const [rxErr, setRxErr] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [discharging, setDischarging] = useState(false);

  const { data: encDetails } = useQuery({
    queryKey: ["encounter-details", journey.encounterId],
    queryFn: () => api.encounter(journey.encounterId!),
    enabled: !!journey.encounterId,
  });

  const toggleTest = (t: string) => setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  async function runCds(items: any[]) {
    setRxBusy(true); 
    setRxDone(null); 
    setRxErr(null);
    try {
      const payloadItems = items.map((it) => ({
        drug_name: it.drug_name,
        dose: it.dose,
        frequency: it.frequency,
        duration_days: it.duration_days ? parseInt(String(it.duration_days), 10) : null,
        instructions: it.instructions || null,
      }));
      const r = await api.createRx({ encounter_id: journey.encounterId!, items: payloadItems });
      setCds(r.result); 
      setRxId(r.rx_id);
    } finally { 
      setRxBusy(false); 
    }
  }

  async function approve() {
    if (!rxId) return;
    setRxBusy(true); 
    setRxErr(null);
    try {
      const r = await api.approveRx(rxId, { approved_by: journey.doctorName || "Attending Doctor", accept_substitutions: rxAccept, override_warnings: rxOverride });
      setRxDone(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setRxErr("Blocked by CDS — resolve the allergy conflict, accept a substitution, or override warning.");
        setCds((e.detail as any)?.cds?.result || cds);
      }
    } finally { 
      setRxBusy(false); 
    }
  }

  async function approveNoMeds() {
    setRxBusy(true);
    setRxErr(null);
    setRxDone(null);
    try {
      const draft = await api.createRx({ encounter_id: journey.encounterId!, items: [] });
      const r = await api.approveRx(draft.rx_id, { approved_by: journey.doctorName || "Attending Doctor", accept_substitutions: false, override_warnings: false });
      setRxDone(r);
    } catch (e: any) {
      setRxErr(e.message || "Failed to e-sign empty prescription");
    } finally {
      setRxBusy(false);
    }
  }

  async function getSuggestions(encounterId: string) {
    setLoadingSuggestions(true);
    try {
      const r = await api.suggestLabOrders(encounterId);
      setSuggestions(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const handleSelectPatient = (enc: any) => {
    setSel([]);
    setSuggestions([]);
    setRxItems([]);
    setCds(null);
    setRxId(null);
    setRxBusy(false);
    setRxAccept(false);
    setRxOverride(false);
    setRxDone(null);
    setRxErr(null);
    journey.set({
      patientId: enc.patient.patient_id,
      encounterId: enc.encounter_id,
      patientName: enc.patient.name,
      token: enc.token?.number || null,
      department: enc.visit_type || null,
      chiefComplaint: enc.triage?.chief_complaint || null,
      doctorName: enc._doctorName || null,
    });
  };

  const handleResetJourney = () => {
    setSel([]);
    setSuggestions([]);
    journey.reset();
  };

  const handleBackToQueue = () => {
    if (rxDone) {
      handleResetJourney();
      return;
    }
    if (window.confirm("This patient hasn't been discharged yet. Go back to the queue anyway?")) {
      handleResetJourney();
    }
  };

  if (!journey.encounterId || !journey.patientId) {
    return <DoctorQueue onSelectPatient={handleSelectPatient} />;
  }

  const initials = (journey.patientName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden !p-3 sm:!p-3.5">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(360px 140px at 0% 0%, rgba(0,120,212,0.08), transparent)" }}
        />
        <div className="relative space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="avatar-disc h-11 w-11 text-sm">{initials}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h1 className="grad-text-page min-w-0 truncate text-xl font-extrabold leading-tight">{journey.patientName}</h1>
                  <span className="text-[12px] font-semibold text-[var(--muted)]">
                    {[
                      encDetails?.patient?.age != null ? `${encDetails.patient.age} yrs` : null,
                      encDetails?.patient?.gender,
                      encDetails?.patient?.blood_group && encDetails.patient.blood_group !== "UNK"
                        ? `Blood ${encDetails.patient.blood_group}`
                        : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold">
                  {journey.department && <span className="text-[var(--muted)]">{journey.department}</span>}
                  {journey.token && <span className="text-[var(--cyan)]">Token {journey.token}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot label="Session active" tone="mint" />
              <button
                className="btn ghost text-[11.5px] !px-2.5 !py-1.5 font-bold"
                onClick={handleBackToQueue}
              >
                <ArrowLeft size={13} /> Back to Queue
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--line)] pt-2">
            <div className="min-w-0 text-[12px] leading-relaxed text-[var(--muted)]">
              <span className="mr-1.5 font-bold text-[var(--dim)]">Reason</span>
              <span className="font-semibold text-[var(--ink)]">
                {encDetails?.triage?.chief_complaint || journey.chiefComplaint || "Not recorded"}
              </span>
              {encDetails?.patient_original_reason && encDetails.patient_original_reason !== (encDetails?.triage?.chief_complaint || journey.chiefComplaint) && (
                <span className="ml-2 text-[11px] text-amber-700">Patient reported: “{encDetails.patient_original_reason}”</span>
              )}
            </div>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--cyan)] hover:underline"
              title="View complete intake version history and audit log"
            >
              <History size={12} /> Audit history
            </button>
          </div>
        </div>
      </div>

      {/* Outer Grid Layout (Workflow + Clinical Decision Support Pane) */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,440px)] 2xl:gap-6">
        <div className="space-y-4">
          {/* Tabs */}
          <div className="tab-pills">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`tab-pill ${tab === t.id ? "is-active" : ""}`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          <div className={tab === "p360" ? "" : "hidden"} key={`360-${journey.patientId}`}>
            <Patient360 patientId={journey.patientId} encounterId={journey.encounterId} />
          </div>

          <div className={tab === "soap" ? "" : "hidden"} key={`soap-${journey.encounterId}`}>
            <AmbientSoap encounterId={journey.encounterId} doctorName={journey.doctorName} />
          </div>

          <div className={tab === "labs" ? "" : "hidden"} key={`labs-${journey.encounterId}`}>
            <OrdersAndLabs encounterId={journey.encounterId} sel={sel} setSel={setSel} doctorName={journey.doctorName} />
          </div>
          
          <div className={tab === "rx" ? "" : "hidden"} key={`rx-${journey.encounterId}`}>
            <Prescription 
              encounterId={journey.encounterId}
              items={rxItems}
              setItems={setRxItems}
              cds={cds}
              setCds={setCds}
              rxId={rxId}
              setRxId={setRxId}
              busy={rxBusy}
              done={rxDone}
              setDone={setRxDone}
              err={rxErr}
              setErr={setRxErr}
              runCds={runCds}
              approveNoMeds={approveNoMeds}
              onDischarged={handleResetJourney}
            />
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--dim)" }}>
            <Sparkles size={12} style={{ color: "var(--cyan)" }} /> AI Copilot
          </div>
          <CopilotSidepane 
            patientId={journey.patientId} 
            tab={tab}
            encounterId={journey.encounterId}
            chiefComplaint={journey.chiefComplaint}
            sel={sel}
            toggle={toggleTest}
            suggestions={suggestions}
            loadingSuggestions={loadingSuggestions}
            onGetSuggestions={() => getSuggestions(journey.encounterId!)}
            
            rxItems={rxItems}
            setRxItems={setRxItems}
            cds={cds}
            setCds={setCds}
            rxId={rxId}
            rxBusy={rxBusy}
            rxAccept={rxAccept}
            setRxAccept={setRxAccept}
            rxOverride={rxOverride}
            setRxOverride={setRxOverride}
            rxDone={rxDone}
            rxErr={rxErr}
            approveRx={approve}
            runCds={runCds}
          />
        </div>
      </div>

      {/* Intake Audit History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4" style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(20, 33, 61, 0.15)",
            color: "var(--ink)",
            boxShadow: "0 20px 40px rgba(20, 33, 61, 0.25)"
          }}>
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="text-lg font-extrabold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <History className="text-[var(--cyan)]" size={20} /> Clinical Complaint Audit History
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="btn ghost !py-1 !px-2.5 text-xs font-bold"
                style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
              >
                ✕ Close
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3.5 rounded-xl" style={{
                background: "rgba(0,120,212, 0.08)",
                border: "1px solid rgba(0,120,212, 0.18)"
              }}>
                <div className="font-bold text-xs" style={{ color: "var(--muted)" }}>Current Active Clinical Complaint (Triage Assessment):</div>
                <div className="text-sm font-extrabold mt-1" style={{ color: "var(--cyan)" }}>
                  {encDetails?.triage?.chief_complaint || journey.chiefComplaint || "No complaint recorded"}
                </div>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                <h4 className="font-bold text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Audit Timeline & Version Edits</h4>

                {/* Patient Original Entry */}
                <div className="p-3 rounded-xl space-y-1.5" style={{
                  background: "rgba(255, 255, 255, 0.65)",
                  border: "1px solid var(--line2)"
                }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-600 flex items-center gap-1.5 text-xs">
                      👤 Patient Intake (Initial Booking)
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>Version 1</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--ink)" }}>
                    <b>Entered:</b> "{encDetails?.patient_original_reason || encDetails?.notes || "Initial Intake"}"
                  </div>
                </div>

                {/* Triage & Audit Logs */}
                {encDetails?.audit_logs?.map((log: any, idx: number) => (
                  <div key={log.audit_id || idx} className="p-3 rounded-xl space-y-1.5" style={{
                    background: "rgba(255, 255, 255, 0.65)",
                    border: "1px solid var(--line2)"
                  }}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 flex items-center gap-1.5 text-xs">
                        {log.edited_by_role === "NURSE" ? "🩺 Nurse Triage Edit" : "👨‍⚕️ Clinician Edit"}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>
                        {log.created_ts ? new Date(log.created_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `Version ${idx + 2}`}
                      </span>
                    </div>
                    {log.old_value && (
                      <div className="text-[11px] line-through" style={{ color: "var(--muted)" }}>
                        <b>Previous:</b> "{log.old_value}"
                      </div>
                    )}
                    <div className="text-xs font-semibold" style={{ color: "var(--cyan)" }}>
                      <b>Updated To:</b> "{log.new_value}"
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                      Edited by: <b>{log.edited_by_user || log.edited_by_role}</b>
                    </div>
                  </div>
                ))}

                {(!encDetails?.audit_logs || encDetails.audit_logs.length === 0) && (
                  <div className="p-4 rounded-xl text-center text-xs" style={{
                    background: "rgba(255, 255, 255, 0.4)",
                    border: "1px solid var(--line)",
                    color: "var(--muted)"
                  }}>
                    No triage modifications recorded for this visit. Intake complaint matches patient's initial self-reported reason.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="btn font-bold text-xs py-1.5 px-4"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
