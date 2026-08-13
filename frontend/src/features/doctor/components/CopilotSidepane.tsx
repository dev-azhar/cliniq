import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, ShieldAlert, BadgeCheck, Plus, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../../lib/api";
import { Card, Tag, AgentBadge, Empty } from "../../../components/ui";

interface CopilotSidepaneProps {
  patientId: string;
  tab: string;
  encounterId: string | null;
  chiefComplaint?: string | null;
  sel: string[];
  toggle: (t: string) => void;
  suggestions: any[];
  loadingSuggestions: boolean;
  onGetSuggestions: () => void;

  // Hoisted Rx properties
  rxItems: any[];
  setRxItems: React.Dispatch<React.SetStateAction<any[]>>;
  cds: any;
  setCds: (cds: any) => void;
  rxId: string | null;
  rxBusy: boolean;
  rxAccept: boolean;
  setRxAccept: (accept: boolean) => void;
  rxOverride: boolean;
  setRxOverride: (override: boolean) => void;
  rxDone: any;
  rxErr: string | null;
  approveRx: () => void;
  runCds: (items: any[]) => void;
}

function isAbnormalVital(key: string, value: any): boolean {
  if (value == null || value === "") return false;
  if (key === "bp") {
    const [systolic, diastolic] = String(value).split("/").map(Number);
    return !!systolic && !!diastolic && (systolic >= 140 || systolic < 90 || diastolic >= 90 || diastolic < 60);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return false;
  if (key === "spo2") return numeric < 95;
  if (key === "heart_rate") return numeric < 55 || numeric > 100;
  if (key === "temperature") return numeric < 97 || numeric >= 100.4;
  if (key === "bmi") return numeric < 18.5 || numeric >= 30;
  return false;
}

function isTemperatureWarning(key: string, value: any): boolean {
  if (key !== "temperature") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 99 && numeric < 100.4;
}

export default function CopilotSidepane({
  patientId,
  tab,
  encounterId,
  chiefComplaint,
  sel,
  toggle,
  suggestions,
  loadingSuggestions,
  onGetSuggestions,

  rxItems,
  setRxItems,
  cds,
  setCds,
  rxId,
  rxBusy,
  rxAccept,
  setRxAccept,
  rxOverride,
  setRxOverride,
  rxDone,
  rxErr,
  approveRx,
  runCds,
}: CopilotSidepaneProps) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDrugName, setNewDrugName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [savingMed, setSavingMed] = useState(false);
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showAllMedications, setShowAllMedications] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(tab === "p360");

  useEffect(() => {
    setSummaryOpen(tab === "p360");
  }, [tab]);
  
  const { data, isLoading } = useQuery({
    queryKey: ["p360", patientId],
    queryFn: () => api.patient360(patientId),
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Card className="text-center py-6 text-xs text-[var(--dim)]">Loading clinical context...</Card>;
  if (!data) return null;

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName.trim()) return;
    setSavingMed(true);
    try {
      await api.addPatientMedication(patientId, {
        drug_name: newDrugName.trim(),
        dosage: newDosage.trim() || undefined,
      });
      setNewDrugName("");
      setNewDosage("");
      setShowAddForm(false);
      qc.invalidateQueries({ queryKey: ["p360", patientId] });
    } catch (err) {
      console.error(err);
      alert("Failed to add medication.");
    } finally {
      setSavingMed(false);
    }
  };

  const handleDeleteMed = async (medId: string) => {
    if (!window.confirm("Are you sure you want to remove this medication?")) return;
    setDeletingMedId(medId);
    try {
      await api.deletePatientMedication(patientId, medId);
      qc.invalidateQueries({ queryKey: ["p360", patientId] });
    } catch (err) {
      console.error(err);
      alert("Failed to remove medication.");
    } finally {
      setDeletingMedId(null);
    }
  };

  async function handleGenerate() {
    setGenerating(true);
    try {
      await api.generateSummary(patientId);
      qc.invalidateQueries({ queryKey: ["p360", patientId] });
    } finally {
      setGenerating(false);
    }
  }

  const summaryText = data.ai_summary?.result?.summary;
  const previousIssues = data.issues?.filter(
    (issue: any) => !chiefComplaint || issue.issue_name.toLowerCase().trim() !== chiefComplaint.toLowerCase().trim()
  ) || [];
  const warningItems = [
    ...(data.allergies || []).map((allergy: any, index: number) => ({
      key: `allergy-${allergy.substance}-${index}`,
      label: `Allergy: ${allergy.substance}`,
      tone: "red",
    })),
    ...previousIssues.map((issue: any) => ({
      key: issue.issue_id,
      label: `${issue.issue_name}${issue.onset_info ? ` (${issue.onset_info})` : ""}`,
      tone: "amber",
    })),
  ];
  const visibleWarnings = showAllIssues ? warningItems : warningItems.slice(0, 3);
  const visibleMedications = showAllMedications ? (data.medications || []) : (data.medications || []).slice(0, 3);
  const vitalsUpdatedLabel = (() => {
    const capturedAt = data.latest_vitals?.captured_ts;
    if (!capturedAt) return "Update time unavailable";
    const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(capturedAt) ? capturedAt : `${capturedAt}Z`;
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(normalized).getTime()) / 60_000));
    if (!Number.isFinite(elapsedMinutes)) return "Update time unavailable";
    if (elapsedMinutes < 1) return "Updated just now";
    return `Updated ${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  })();

  const sevTone = (s: string) => (s === "BLOCK" ? "red" : s === "MAJOR" || s === "WARN" ? "amber" : "blue");

  const applySuggestion = (forDrug: string, newDrug: string) => {
    setRxItems((s) => s.map((it) => {
      const isMatch = it.drug_name.toLowerCase().trim() === forDrug.toLowerCase().trim() || 
                      it.drug_name.toLowerCase().includes(forDrug.toLowerCase().trim()) || 
                      forDrug.toLowerCase().includes(it.drug_name.toLowerCase().trim());
      return isMatch ? { ...it, drug_name: newDrug } : it;
    }));
    setCds(null);
  };

  const renderSummaryCard = () => (
    <Card className="order-2 relative overflow-hidden" style={{ background: "radial-gradient(150px 50px at 0% 0%, rgba(0,120,212,0.08), transparent)" }}>
      <div className={`flex items-center justify-between gap-2 ${summaryOpen ? "mb-2" : ""}`}>
        <button
          type="button"
          onClick={() => setSummaryOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-[var(--cyan)]"
          aria-expanded={summaryOpen}
        >
          <Activity size={13} /> Clinical Summary
          {summaryOpen ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
        </button>
        {summaryOpen && summaryText && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--cyan)] transition hover:text-sky-400 disabled:opacity-50"
          >
            {generating ? "Updating..." : "↻ Refresh"}
          </button>
        )}
      </div>
      {summaryOpen && (
        summaryText ? (
          <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-[var(--ink)]">{summaryText}</p>
        ) : (
          <div className="py-1 text-center">
            <p className="mb-2 text-[11px] text-[var(--muted)]">History summary has not been generated yet.</p>
            <button onClick={handleGenerate} disabled={generating} className="btn w-full justify-center !px-2.5 !py-1 text-[11px]">
              {generating ? "Generating..." : "Generate Summary"}
            </button>
          </div>
        )
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-300">
      {tab === "labs" ? (
        <>
        {renderSummaryCard()}
        {/* Suggested Orders */}
        <Card className="order-2 border border-dashed border-[var(--cyan)]/25 relative overflow-hidden" style={{ background: "radial-gradient(150px 50px at 0% 0%, rgba(0,120,212,0.08), transparent)" }}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-[var(--cyan)] uppercase tracking-wider">
              <Activity size={13} /> Suggested Orders
            </div>
            <AgentBadge label="Suggested" />
          </div>
          {suggestions.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[12px] leading-relaxed text-[var(--muted)]">Click below to check for clinically indicated diagnostics.</p>
              <button 
                onClick={onGetSuggestions} 
                disabled={loadingSuggestions} 
                className="btn w-full !py-1 text-xs font-bold"
                style={{ background: "rgba(0,120,212,0.08)", border: "1px solid rgba(0,120,212,0.25)", color: "var(--cyan)" }}
              >
                {loadingSuggestions ? "Checking..." : "Get Suggested Orders"}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-[12.5px]">
              {suggestions.map((s: any, idx: number) => {
                const isSelected = sel.includes(s.test);
                return (
                  <div key={idx} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">{s.test}</span>
                      <button
                        onClick={() => toggle(s.test)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {isSelected ? "Selected" : "Add to Order"}
                      </button>
                    </div>
                    <div className="text-[11.5px] text-[var(--muted)] leading-relaxed">
                      {s.reason}
                    </div>
                  </div>
                );
              })}
              <button 
                onClick={onGetSuggestions} 
                disabled={loadingSuggestions} 
                className="text-[11px] text-[var(--cyan)] hover:underline block mt-2 text-right w-full"
              >
                {loadingSuggestions ? "Refreshing..." : "↻ Refresh Suggestions"}
              </button>
            </div>
          )}
        </Card>
        </>
      ) : (
        renderSummaryCard()
      )}

      <Card className="order-1 space-y-3 overflow-hidden animate-in fade-in duration-300">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Latest Vitals</div>
            <span className="text-[9px] font-semibold text-[var(--cyan)]">{vitalsUpdatedLabel}</span>
          </div>
          {data.latest_vitals ? (
            <div className="grid grid-cols-2 gap-1.5 text-center text-[10px]">
              {[
                { key: "bp", label: "BP", raw: data.latest_vitals.bp, value: data.latest_vitals.bp || "—" },
                { key: "spo2", label: "SpO₂", raw: data.latest_vitals.spo2, value: data.latest_vitals.spo2 != null ? `${data.latest_vitals.spo2}%` : "—" },
                { key: "heart_rate", label: "Heart Rate", raw: data.latest_vitals.heart_rate, value: data.latest_vitals.heart_rate != null ? `${data.latest_vitals.heart_rate} bpm` : "—" },
                { key: "temperature", label: "Temperature", raw: data.latest_vitals.temperature, value: data.latest_vitals.temperature != null ? `${data.latest_vitals.temperature}°F` : "—" },
                { key: "weight", label: "Weight", raw: data.latest_vitals.weight_kg, value: data.latest_vitals.weight_kg != null ? `${data.latest_vitals.weight_kg} kg` : "—" },
                { key: "height", label: "Height", raw: data.latest_vitals.height_cm, value: data.latest_vitals.height_cm != null ? `${data.latest_vitals.height_cm} cm` : "—" },
                { key: "bmi", label: "BMI", raw: data.latest_vitals.bmi, value: data.latest_vitals.bmi != null ? String(data.latest_vitals.bmi) : "—" },
              ].map((vital) => (
                <div
                  key={vital.key}
                  className={`relative rounded-lg border px-2 py-1.5 ${
                    isTemperatureWarning(vital.key, vital.raw)
                      ? "border-amber-500/45 bg-amber-500/10 text-amber-800"
                      : isAbnormalVital(vital.key, vital.raw)
                      ? "border-red-500/45 bg-red-500/10 text-red-800"
                      : "border-[var(--line)] bg-[rgba(0,120,212,0.04)]"
                  } ${vital.label === "BMI" ? "col-span-2" : ""}`}
                >
                  {(isTemperatureWarning(vital.key, vital.raw) || isAbnormalVital(vital.key, vital.raw)) && (
                    <AlertTriangle size={11} className="absolute right-1.5 top-1.5" />
                  )}
                  <span className="block text-[9px] text-[var(--dim)]">{vital.label}</span>
                  <b className={`text-[11px] ${
                    isTemperatureWarning(vital.key, vital.raw)
                      ? "text-amber-800"
                      : isAbnormalVital(vital.key, vital.raw)
                        ? "text-red-800"
                        : "text-[var(--ink)]"
                  }`}>{vital.value}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">No vitals captured</div>
          )}
        </section>

        <section className="space-y-2 border-t border-[var(--line)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Previous Issues &amp; Warnings</div>
            {warningItems.length > 3 && (
              <button type="button" onClick={() => setShowAllIssues((open) => !open)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--cyan)] hover:underline">
                {showAllIssues ? "Show less" : `View all (${warningItems.length})`}
                {showAllIssues ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleWarnings.map((warning: any) => (
              <Tag key={warning.key} tone={warning.tone}>⚠ {warning.label}</Tag>
            ))}
            {!warningItems.length && (
              <div className="text-[11px] text-[var(--muted)]">No previous issues or warnings recorded</div>
            )}
          </div>
        </section>

        <section className="space-y-2 border-t border-[var(--line)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Active Medications</div>
            <div className="flex items-center gap-2">
              {(data.medications?.length || 0) > 3 && (
                <button type="button" onClick={() => setShowAllMedications((open) => !open)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--cyan)] hover:underline">
                  {showAllMedications ? "Show less" : `View all (${data.medications.length})`}
                  {showAllMedications ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="btn ghost !px-1.5 !py-0.5 text-[10px] font-bold"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddMed} className="space-y-2 rounded-lg border border-[var(--line)] bg-white/20 p-2 text-xs">
              <input
                type="text"
                required
                placeholder="Drug name"
                className="input w-full !px-2 !py-1 text-xs"
                value={newDrugName}
                onChange={(e) => setNewDrugName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Dosage (optional)"
                className="input w-full !px-2 !py-1 text-xs"
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
              />
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => { setShowAddForm(false); setNewDrugName(""); setNewDosage(""); }} className="btn ghost !px-2 !py-1 text-[10px]">
                  Cancel
                </button>
                <button type="submit" disabled={savingMed} className="btn !px-3 !py-1 text-[10px]">
                  {savingMed ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}

          {data.medications?.length ? (
            <ul className="space-y-1.5 text-[11.5px] text-[var(--muted)]">
              {visibleMedications.map((medication: any) => (
                <li key={medication.medication_id} className="group flex items-center justify-between gap-2">
                  <span>• <b>{medication.drug_name}</b>{medication.dosage ? ` (${medication.dosage})` : ""}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteMed(medication.medication_id)}
                    disabled={deletingMedId === medication.medication_id}
                    className="text-[10px] font-bold text-slate-400 opacity-0 transition hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Remove ${medication.drug_name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">None recorded</div>
          )}
        </section>
      </Card>

      {/* Clinical Decision Support Output Card when on Rx tab */}
      {tab === "rx" && (
        <Card className="order-3 border border-[var(--glass-border)] relative overflow-hidden mt-3" style={{ background: "rgba(255,255,255,0.01)" }}>
          {rxDone ? (
            <div className="space-y-3 py-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "var(--mint)" }}>
                <CheckCircle2 size={18} /> Approved &amp; e-signed.
              </div>
              <p className="text-[11.5px] text-[var(--muted)]">Prescription finalized successfully.</p>
            </div>
          ) : !cds ? (
            <Empty>Allergy, interaction, dose, formulary and live stock are checked automatically.</Empty>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="font-bold text-slate-100" style={{ color: "#004578" }}>Clinical Decision Support</h4>
                <AgentBadge label="Rx CDS" />
              </div>
              {cds.block && (
                <div className="alertbox mb-2">
                  <ShieldAlert size={15} className="inline mr-1" /> Prescription contains a blocking allergy conflict.
                </div>
              )}
              <div className="space-y-1.5">
                {cds.alerts.length ? (
                  cds.alerts.map((a: any, i: number) => (
                    <div key={i} className="kv">
                      <span>{a.drug}</span>
                      <span className="flex-1 px-2 text-[11.5px]" style={{ color: "var(--muted)" }}>{a.message}</span>
                      <Tag tone={sevTone(a.severity)}>{a.severity}</Tag>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--mint)" }} className="font-semibold">✓ No conflicts — safe to prescribe.</div>
                )}
              </div>
              {cds.suggestions?.length > 0 && (
                <div className="holo mt-2 text-[11.5px] space-y-1.5 bg-white/[0.01] p-2.5 rounded-xl border border-white/5">
                  <div className="font-semibold text-white flex items-center gap-1">
                    <AgentBadge label="Suggested" /> Suggested alternatives (click to apply):
                  </div>
                  {cds.suggestions.map((s: any, i: number) => {
                    const isErr = s.suggestion === "No response was returned";
                    return isErr ? (
                      <div key={i} className="text-left w-full p-2 rounded text-rose-400 border border-rose-500/20 bg-rose-950/10 mt-1 font-semibold text-[10.5px]">
                        ⚠ {s.suggestion} — <span className="text-[10px] text-[var(--muted)]">{s.reason}</span>
                      </div>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applySuggestion(s.for, s.suggestion)}
                        className="block text-left w-full hover:bg-white/5 p-1 rounded transition text-[var(--cyan)] border border-dashed border-[var(--cyan)]/25 px-2 py-0.5 mt-1 text-[11px]"
                      >
                        • Use <b>{s.suggestion}</b> for {s.for} — <span className="text-[10.5px] text-[var(--muted)]">{s.reason}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
                <label className="flex items-center gap-2 text-[11.5px] cursor-pointer" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={rxAccept} onChange={(e) => { setRxAccept(e.target.checked); if (e.target.checked) setRxOverride(false); }} /> Accept suggested substitutions
                </label>
                {cds.block && (
                  <label className="flex items-center gap-2 text-[11.5px] text-rose-400 font-semibold cursor-pointer">
                    <input type="checkbox" checked={rxOverride} onChange={(e) => { setRxOverride(e.target.checked); if (e.target.checked) setRxAccept(false); }} /> Override allergy conflict warning (sign anyway)
                  </label>
                )}
              </div>
              {rxErr && <div className="alertbox mt-2 text-rose-400 border-rose-500/10 bg-rose-950/5">{rxErr}</div>}
              <button 
                className="btn g mt-3 w-full justify-center font-bold" 
                disabled={rxBusy || (cds.block && !rxAccept && !rxOverride)} 
                onClick={approveRx}
              >
                <BadgeCheck size={16} /> {rxBusy ? "Signing..." : "Approve & E-sign"}
              </button>
            </div>
          )}
        </Card>
      )}

    </div>
  );
}
