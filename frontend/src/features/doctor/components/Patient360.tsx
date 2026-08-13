import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { api } from "../../../lib/api";
import { Card, Tag, Empty } from "../../../components/ui";

/* ------------------------------------------------------------------ Historical Visit Dropdown */
function HistoricalVisitDropdown({ encounter }: { encounter: any }) {
  const [open, setOpen] = useState(false);

  // Fetch full details of selected encounter dynamically
  const { data: details, isLoading } = useQuery({
    queryKey: ["encounter-details", encounter.encounter_id],
    queryFn: () => api.encounter(encounter.encounter_id),
    enabled: open,
  });

  return (
    <div className="border rounded-xl transition" style={{ borderColor: "var(--glass-border)", background: open ? "rgba(255,255,255,0.015)" : "transparent" }}>
      <button 
        onClick={() => setOpen(!open)}
        className="w-full text-left p-2 flex items-center justify-between text-xs font-semibold hover:bg-white/5 rounded-xl transition"
      >
        <div className="truncate">
          <span className="text-white font-bold">{encounter.date}</span>
          <span className="text-[var(--dim)] ml-1.5">· {encounter.department}</span>
        </div>
        <span className="text-[var(--cyan)] font-bold text-[13px] ml-2">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="p-3 border-t border-[var(--glass-border)] space-y-3 text-[11px] leading-relaxed">
          {isLoading ? (
            <div className="text-center py-2 text-[var(--dim)]">Retrieving raw EMR records...</div>
          ) : details ? (
            <>
              {/* Vitals */}
              {details.vitals ? (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-1">Vitals:</div>
                  <div className="grid grid-cols-2 gap-1 text-[10.5px] sm:grid-cols-3">
                    <div className="bg-white/5 p-1 rounded text-center"><small style={{ color: "var(--dim)" }}>BP</small><br /><b>{details.vitals.bp}</b></div>
                    <div className="bg-white/5 p-1 rounded text-center"><small style={{ color: "var(--dim)" }}>SpO₂</small><br /><b>{details.vitals.spo2}%</b></div>
                    <div className="bg-white/5 p-1 rounded text-center"><small style={{ color: "var(--dim)" }}>Temp</small><br /><b>{details.vitals.temperature}°F</b></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-0.5">Vitals:</div>
                  <span className="text-[var(--muted)]">No vitals captured.</span>
                </div>
              )}

              {/* Diagnosed Conditions / Issues */}
              {details.note?.icd10_codes?.length > 0 && (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-1">Diagnosed Condition(s):</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {details.note.icd10_codes.map((icd: any) => (
                      <span key={icd.code} className="text-[10.5px] bg-red-500/10 text-red-400 font-bold px-2.5 py-0.5 rounded-xl border border-red-500/20">
                        ⚠ {icd.label} ({icd.code})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SOAP Note Text */}
              {details.note ? (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-1">Clinical Note (SOAP):</div>
                  <div className="p-2 rounded bg-white/5 border border-white/5 text-[10.5px] whitespace-pre-line text-slate-300">
                    {details.note.final_text}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-0.5">Clinical Note (SOAP):</div>
                  <span className="text-[var(--muted)]">Not documented or pending.</span>
                </div>
              )}

              {/* Prescription Items */}
              {details.prescription && details.prescription.items?.length > 0 ? (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-1">Prescribed Medications:</div>
                  <ul className="list-disc list-inside text-[var(--muted)] space-y-0.5 text-[10.5px]">
                    {details.prescription.items.map((item: any, idx: number) => (
                      <li key={idx}>
                        <span className="text-slate-300 font-medium">{item.drug_name}</span> ({item.dose}) — <span className="italic">{item.frequency}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-0.5">Prescribed Medications:</div>
                  <span className="text-[var(--muted)]">No medications prescribed.</span>
                </div>
              )}

              {/* Lab Results */}
              {details.labs?.length > 0 ? (
                <div>
                  <div className="font-bold text-white text-[10px] uppercase tracking-wide text-[var(--dim)] mb-1">Lab Results:</div>
                  <div className="space-y-1">
                    {details.labs.map((o: any) => (
                      <div key={o.lab_order_id} className="p-1.5 border border-white/5 rounded bg-white/5">
                        <div className="font-semibold text-slate-300 text-[10.5px]">{o.test}</div>
                        {o.results?.map((r: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px] mt-0.5 text-[var(--muted)]">
                            <span>• {r.analyte}</span>
                            <span className={r.flag !== "N" ? "text-amber-400 font-bold" : ""}>
                              {r.value} {r.unit} {r.flag !== "N" ? `(${r.flag})` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : <div className="text-center py-2 text-[var(--dim)]">Failed to load details.</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Patient 360 Core Component */
interface Patient360Props {
  patientId: string;
  encounterId: string | null;
}

export default function Patient360({ patientId, encounterId }: Patient360Props) {
  const qc = useQueryClient();
  const [adviceNotes, setAdviceNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);
  
  const [newIssueName, setNewIssueName] = useState("");
  const [newIssueOnset, setNewIssueOnset] = useState("");
  const [addingIssue, setAddingIssue] = useState(false);

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueName.trim()) return;
    setAddingIssue(true);
    try {
      await api.addPatientIssue(patientId, {
        issue_name: newIssueName.trim(),
        onset_info: newIssueOnset.trim() || undefined,
      });
      setNewIssueName("");
      setNewIssueOnset("");
      qc.invalidateQueries({ queryKey: ["p360", patientId] });
    } catch (err) {
      console.error(err);
      alert("Failed to add medical issue.");
    } finally {
      setAddingIssue(false);
    }
  };

  const { data, error, isLoading } = useQuery({
    queryKey: ["p360", patientId],
    queryFn: () => api.patient360(patientId),
    retry: false,
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const { data: activeEncounter } = useQuery({
    queryKey: ["active-encounter", encounterId],
    queryFn: async () => {
      if (!encounterId) return null;
      const res = await api.encounter(encounterId);
      if (res && res.notes) {
        setAdviceNotes(res.notes);
      }
      return res;
    },
    enabled: !!encounterId,
  });

  const parentEncounterId = activeEncounter?.parent_encounter_id;

  const { data: parentEncounter } = useQuery({
    queryKey: ["parent-encounter-notes", parentEncounterId],
    queryFn: () => api.encounter(parentEncounterId!),
    enabled: !!parentEncounterId,
  });

  const handleSaveNotes = async () => {
    if (!encounterId) return;
    setSavingNotes(true);
    setNotesSuccess(false);
    try {
      const res = await api.updateEncounterNotes(encounterId, adviceNotes);
      if (res && res.notes) {
        setAdviceNotes(res.notes);
      }
      setNotesSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save consultation notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  if (isLoading) return <Card>Loading record…</Card>;
  if (error) {
    return (
      <Card className="space-y-3">
        <div className="alertbox">Consent required to read this record.</div>
        <button className="btn" onClick={async () => { await api.consent(patientId); qc.invalidateQueries({ queryKey: ["p360", patientId] }); }}>
          Capture consent &amp; assemble Patient 360
        </button>
      </Card>
    );
  }

  const flag = (f: string) => (f === "N" ? "green" : f === "H" || f === "L" ? "amber" : "red");
  const recentLabSections = Array.from(
    (data.recent_results || []).reduce((groups: Map<string, any>, result: any) => {
      const key = result.lab_order_id || `${result.test || "Lab Test"}-${result.date}`;
      const existing = groups.get(key);
      if (existing) existing.results.push(result);
      else groups.set(key, {
        lab_order_id: key,
        test: result.test || "Lab Test",
        date: result.date,
        results: [result],
      });
      return groups;
    }, new Map<string, any>()).values()
  );

  return (
    <div className="patient-360-layout min-w-0 space-y-4">
      {/* Chronic Medical Issues (Problem List) */}
      <Card className="space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ background: "radial-gradient(150px 50px at 0% 0%, rgba(239,68,68,0.04), transparent)" }}>
        <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
          <h4 className="font-bold flex items-center gap-1.5" style={{ color: "#004578" }}>
            Chronic Medical Issues (Problem List)
          </h4>
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--dim)]">Persists Across Encounters</span>
        </div>
        
        {data.issues?.length ? (
          <div className="flex flex-wrap gap-2 pb-1">
            {data.issues.map((i: any) => (
              <div 
                key={i.issue_id} 
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 font-bold"
              >
                <span>⚠ {i.issue_name}</span>
                {i.onset_info && <span className="text-[10px] text-slate-400 font-normal">({i.onset_info})</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] pb-1">No chronic medical issues recorded for this patient.</p>
        )}

        <form onSubmit={handleAddIssue} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs pt-2.5 border-t border-white/5">
          <div className="sm:col-span-6">
            <input
              type="text"
              placeholder="New Issue (e.g. Heart Attack, Diabetes)"
              className="input w-full py-1.5 px-3 text-xs"
              value={newIssueName}
              onChange={(e) => setNewIssueName(e.target.value)}
              required
              style={{ background: "var(--panel)", borderColor: "var(--glass-border)", color: "var(--ink)" }}
            />
          </div>
          <div className="sm:col-span-3">
            <input
              type="text"
              placeholder="Onset (e.g. 6mo ago)"
              className="input w-full py-1.5 px-3 text-xs"
              value={newIssueOnset}
              onChange={(e) => setNewIssueOnset(e.target.value)}
              style={{ background: "var(--panel)", borderColor: "var(--glass-border)", color: "var(--ink)" }}
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={addingIssue}
              className="btn w-full py-1.5 px-4 text-xs font-bold"
              style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
            >
              {addingIssue ? "Saving..." : "Add Issue"}
            </button>
          </div>
        </form>
      </Card>

      {/* Today's Consultation Notes & Advice */}
      {encounterId && (
        <Card className="space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ background: "radial-gradient(150px 50px at 0% 0%, rgba(0,69,120,0.06), transparent)" }}>
          <div className="flex items-center justify-between">
            <h4 className="font-bold flex items-center gap-1.5" style={{ color: "#004578" }}>
              <FileText size={16} className="text-sky-500" /> Active Consultation Notes &amp; Advice
            </h4>
            {notesSuccess && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> Saved successfully
              </span>
            )}
          </div>
          <div className="space-y-2 text-xs">
            {/* Quick Macro Chips */}
            <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-white/5">
              <span className="text-[10px] text-[var(--muted)] font-bold self-center mr-1">QUICK TEMPLATES:</span>
              {[
                { label: "🌡 Fever Care", text: "Fever Care:\n- Take Tab Paracetamol 650mg if temperature > 100°F (max 4 times/day).\n- Drink plenty of water and warm fluids.\n- Rest well; consume light, easy-to-digest meals." },
                { label: "🤢 Acidity / GERD", text: "Acidity & GERD Care:\n- Take Antacid / Pantoprazole 40mg 30 minutes before breakfast.\n- Avoid spicy, oily, fatty, and caffeinated items.\n- Avoid lying down for 2 hours post-meals." },
                { label: "🤕 Pain Relief", text: "Pain Management:\n- Rest the affected area; avoid strain.\n- Apply warm compress or cold pack as needed.\n- Take pain relievers strictly post-meals." },
                { label: "🩺 Hypertension", text: "Hypertension / BP Advice:\n- Restrict daily dietary sodium/salt intake.\n- Avoid processed foods, pickles, and salty snacks.\n- Monitor Blood Pressure twice daily and record logs." }
              ].map((macro, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAdviceNotes((prev) => {
                      const prefix = prev ? prev.trim() + "\n\n" : "";
                      return prefix + macro.text;
                    });
                    setNotesSuccess(false);
                  }}
                  className="btn ghost !py-0.5 !px-2 text-[10px] border border-white/5 bg-white/[0.02] hover:bg-white/10 text-slate-300 hover:text-white"
                >
                  {macro.label}
                </button>
              ))}
            </div>
            {parentEncounter && (
              <div 
                className="p-3 rounded-xl border text-[11px] space-y-1 mb-2.5 animate-in fade-in duration-200"
                style={{ 
                  background: "rgba(0,69,120, 0.05)", 
                  borderColor: "rgba(0,69,120, 0.25)",
                  color: "var(--ink)"
                }}
              >
                <div className="font-bold flex items-center gap-1.5 text-sky-400">
                  <span>📝</span> Parent Visit Diagnosis & Advice ({parentEncounter.arrival?.slice(0, 10)})
                </div>
                <div className="text-[11px] whitespace-pre-line text-slate-300 text-left">
                  {parentEncounter.notes || "No diagnosis or advice recorded in parent visit."}
                </div>
              </div>
            )}

            <textarea
              className="input w-full"
              rows={3}
              value={adviceNotes}
              onChange={(e) => {
                setAdviceNotes(e.target.value);
                setNotesSuccess(false);
              }}
              placeholder="Enter active clinical findings, general advice, lifestyle instructions, or diagnosis summary for today's encounter..."
              style={{ background: "var(--panel)", borderColor: "var(--glass-border)", color: "var(--ink)" }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="btn !py-1 !px-4 text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #0078d4, #004578)", color: "white", border: "none" }}
              >
                {savingNotes ? "Saving..." : "Save Consultation Notes"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Three columns when wide; only the third moves below at medium width. */}
      <div className="patient-360-columns grid min-w-0 gap-4">
        {/* Column 1: Recent Results */}
        <Card className="flex min-w-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="font-bold" style={{ color: "#004578" }}>Recent results</h4>
            <span className="rounded-full bg-[rgba(0,120,212,0.08)] px-2 py-0.5 text-[10px] font-bold text-[var(--cyan)]">
              {recentLabSections.length} {recentLabSections.length === 1 ? "test" : "tests"}
            </span>
          </div>
          <div className="max-h-[360px] flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
            {recentLabSections.length ? (
              recentLabSections.map((lab: any) => (
                <div key={lab.lab_order_id} className="min-w-0 rounded-xl border border-[var(--line)] bg-white/20 p-2.5">
                  <div className="mb-2 flex min-w-0 items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                    <b className="min-w-0 break-words text-xs leading-tight text-[var(--ink)]">{lab.test}</b>
                    <span className="shrink-0 text-[9px] text-[var(--dim)]">{lab.date}</span>
                  </div>
                  <div className="divide-y divide-[var(--line)]">
                    {lab.results.map((r: any, i: number) => (
                      r.analyte === "Lab Findings" ? (
                        <div key={`${r.analyte}-${i}`} className="py-2 text-[11px] leading-relaxed text-[var(--muted)]">
                          <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide text-[var(--dim)]">Findings</span>
                          <span className="break-words">{r.value || "Result completed"}</span>
                        </div>
                      ) : (
                        <div key={`${r.analyte}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-[11px]">
                          <span className="min-w-0 break-words text-[var(--muted)]">{r.analyte}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <b className="whitespace-nowrap text-[var(--ink)]">{r.value} {r.unit}</b>
                            <Tag tone={flag(r.flag)}>{r.flag}</Tag>
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ))
            ) : <Empty>No results</Empty>}
          </div>
        </Card>

        {/* Column 2: Previous visit records */}
        <Card className="flex min-w-0 flex-col">
          <h4 className="mb-3 font-bold" style={{ color: "#004578" }}>Previous visit records</h4>
          <div className="max-h-[360px] flex-1 space-y-2 overflow-y-auto pr-1">
            {data.encounters?.filter((e: any) => e.encounter_id !== encounterId && e.status === "DISCHARGED").map((e: any) => (
              <HistoricalVisitDropdown key={e.encounter_id} encounter={e} />
            ))}
          </div>
        </Card>

        {/* Column 3: Uploaded reports */}
        <Card className="flex min-w-0 flex-col animate-in fade-in duration-300">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-bold" style={{ color: "#004578" }}>
              <FileText size={16} className="text-[var(--cyan)]" /> Uploaded reports
            </h4>
            <span className="rounded-full bg-[rgba(0,120,212,0.08)] px-2 py-0.5 text-[10px] font-bold text-[var(--cyan)]">
              {data.documents?.length || 0}
            </span>
          </div>
          <div className="max-h-[360px] flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
            {data.documents?.length ? data.documents.map((d: any) => (
              <div 
                key={d.document_id} 
                className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[var(--line)] bg-white/20 p-2.5 text-xs"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,0.08)] text-[var(--cyan)]">
                  <FileText size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words font-semibold leading-tight text-[var(--ink)]">{d.title}</div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">{d.date} · {d.doc_type}</div>
                </div>
                {d.uri ? (
                  <a 
                    href={
                      d.doc_type === "DISCHARGE" && d.encounter_id
                        ? `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/encounters/${d.encounter_id}/discharge-report`
                        : (d.uri.startsWith("http") ? d.uri : `${import.meta.env.VITE_API_BASE_URL ?? ""}${d.uri}`)
                    }
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[10px] font-bold text-[var(--cyan)] hover:underline"
                  >
                    Open <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="shrink-0 pt-0.5 text-[10px] text-[var(--dim)]">Unavailable</span>
                )}
              </div>
            )) : <Empty>No uploaded reports</Empty>}
          </div>
        </Card>
      </div>
    </div>
  );
}
