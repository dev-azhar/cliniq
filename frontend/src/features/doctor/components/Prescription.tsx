import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, CheckCircle2, Pill, BadgeCheck, AlertTriangle } from "lucide-react";
import { api } from "../../../lib/api";
import { useJourney } from "../../../lib/store";
import { Card } from "../../../components/ui";

type Item = { drug_name: string; dose: string; frequency: string; duration_days?: string | number | null; instructions?: string | null };

// Parse an AI "active_ingredients" string (e.g. "Aspirin (75mg) + Clopidogrel (75mg)")
// into individual { name, dose } entries for stock matching + prescription prefill.
function parseIngredients(active?: string | null): { name: string; dose: string }[] {
  if (!active) return [];
  return active
    .split(/\s*\+\s*/)
    .map((part) => {
      const doseMatch = part.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|ml|units?)/i);
      const dose = doseMatch ? `${doseMatch[1]} ${doseMatch[2].toLowerCase()}` : "";
      const name = (part.replace(/\([^)]*\)/g, "").match(/[A-Za-z][A-Za-z-]*(?:\s[A-Za-z][A-Za-z-]*)*/)?.[0] || "").trim();
      return { name, dose };
    })
    .filter((x) => x.name.length > 1);
}

interface PrescriptionProps {
  encounterId: string;
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  cds: any;
  setCds: (cds: any) => void;
  rxId: string | null;
  setRxId: (id: string | null) => void;
  busy: boolean;
  done: any;
  setDone: (done: any) => void;
  err: string | null;
  setErr: (err: string | null) => void;
  runCds: (items: Item[]) => void;
  approveNoMeds: () => void;
  onDischarged: () => void;
}

export default function Prescription({ 
  encounterId, 
  items, 
  setItems, 
  cds, 
  setCds, 
  rxId, 
  setRxId, 
  busy, 
  done, 
  setDone, 
  err, 
  setErr, 
  runCds, 
  approveNoMeds,
  onDischarged,
}: PrescriptionProps) {
  const journey = useJourney();
  const queryClient = useQueryClient();
  const [activeDrugInput, setActiveDrugInput] = useState<number | null>(null);
  const [discharging, setDischarging] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeResult, setDischargeResult] = useState<any>(null);

  const { data: stock } = useQuery({
    queryKey: ["pharmacy-stock"],
    queryFn: () => api.stock(),
    refetchInterval: 10000,
  });

  const { data: encounterPrescription } = useQuery({
    queryKey: ["doctor-encounter-prescription", encounterId],
    queryFn: () => api.encounter(encounterId),
    enabled: Boolean(encounterId),
    refetchInterval: 5000,
  });
  const savedPrescription = encounterPrescription?.prescription;
  const canDischarge = Boolean(done || savedPrescription?.status === "APPROVED");

  const setItem = (i: number, k: keyof Item, val: string) => {
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, [k]: val } : it)));
    setCds(null);
    setRxId(null);
    setDone(null);
    setErr(null);
  };

  const add = (preset?: Item) => {
    setItems((s) => [...s, preset || { drug_name: "", dose: "", frequency: "1-0-1", duration_days: 5 }]);
    setCds(null);
    setRxId(null);
    setDone(null);
    setErr(null);
  };

  const del = (i: number) => {
    setItems((s) => s.filter((_, idx) => idx !== i));
    setCds(null);
    setRxId(null);
    setDone(null);
    setErr(null);
  };

  const selectDrug = (i: number, drugName: string) => {
    setItem(i, "drug_name", drugName);
    setActiveDrugInput(null);
  };

  const completeAndDischarge = async () => {
    setDischarging(true);
    setDischargeError(null);
    try {
      const result = await api.discharge(encounterId);
      await queryClient.invalidateQueries({ queryKey: ["doctor-queue"] });
      setDischargeResult(result);
    } catch (error: any) {
      setDischargeError(error?.message || "Failed to complete and discharge this visit.");
    } finally {
      setDischarging(false);
    }
  };

  // AI Formulary Guidance State
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [guidanceData, setGuidanceData] = useState<any>(null);
  const [showGuidance, setShowGuidance] = useState(true);
  // Maps a recommended generic name -> its live pharmacy-stock availability.
  const [availability, setAvailability] = useState<Record<string, { stock_name: string; available: boolean; unit_price?: number }>>({});

  async function fetchGuidance() {
    setLoadingGuidance(true);
    try {
      const res = await api.getFormularyGuidance(encounterId);
      setGuidanceData(res);
      setShowGuidance(true);

      // Cross-reference each recommended generic against the full pharmacy catalog.
      const names: string[] = Array.from(new Set(
        (res.formula_recommendations || []).flatMap((f: any) =>
          parseIngredients(f.active_ingredients).map((p) => p.name)
        )
      ));
      const map: Record<string, { stock_name: string; available: boolean; unit_price?: number }> = {};
      await Promise.all(names.map(async (n) => {
        try {
          const rows = await api.stock(n);
          const inStock = (rows || []).find((r: any) => (r.available ?? 0) > 0);
          const hit = inStock || (rows || [])[0];
          if (hit) map[n.toLowerCase()] = { stock_name: hit.drug_name, available: Boolean(inStock), unit_price: hit.unit_price };
        } catch {
          /* unresolved -> treated as not available */
        }
      }));
      setAvailability(map);
    } catch (err) {
      console.error("Failed to fetch formulary guidance:", err);
    } finally {
      setLoadingGuidance(false);
    }
  }

  const availabilityFor = (f: any) =>
    parseIngredients(f?.active_ingredients).map((p) => ({
      ...p,
      ...(availability[p.name.toLowerCase()] || { stock_name: "", available: false }),
    }));

  const addItemsToRx = (rows: { stock_name: string; dose: string; available: boolean }[]) => {
    const seen = new Set(items.filter((it) => it.drug_name.trim()).map((it) => it.drug_name.toLowerCase().trim()));
    const additions: Item[] = [];
    for (const r of rows) {
      if (!r.available || !r.stock_name) continue;
      const key = r.stock_name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      additions.push({ drug_name: r.stock_name, dose: r.dose || "", frequency: "1-0-1", duration_days: 5, instructions: null });
    }
    if (!additions.length) return;
    setItems((s) => [...s.filter((it) => it.drug_name.trim()), ...additions]);
    setCds(null);
    setRxId(null);
    setDone(null);
    setErr(null);
  };

  const prefillAvailable = () =>
    addItemsToRx((guidanceData?.formula_recommendations || []).flatMap((f: any) => availabilityFor(f)));

  const availableCount = new Set(
    (guidanceData?.formula_recommendations || [])
      .flatMap((f: any) => availabilityFor(f))
      .filter((r: any) => r.available)
      .map((r: any) => r.stock_name.toLowerCase())
  ).size;

  return (
    <div className="w-full animate-in fade-in duration-300 space-y-3">
      {/* AI Generic Formulary Guidance Advisory Panel */}
      <Card className="border border-sky-600/30 bg-blue-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <div>
              <h4 className="font-bold text-xs text-sky-400">AI Pharmacological & Generic Formula Guidance</h4>
              <p className="text-[11px] text-slate-400">
                Comprehensive worldwide formulary — WHO, BNF, FDA, ESC, ADA, NICE & 40+ international guideline sources. Generic-only, evidence-based.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchGuidance}
            disabled={loadingGuidance}
            className="btn cyan text-xs !py-1 !px-3 inline-flex items-center gap-1.5 shrink-0"
          >
            {loadingGuidance ? "Analyzing..." : "⚡ Suggest Generic Formulas"}
          </button>
        </div>

        {guidanceData && showGuidance && (
          <div className="mt-3 pt-3 border-t border-sky-600/20 space-y-2.5 animate-in fade-in duration-200 text-xs">
            {/* Clean Summary Banner */}
            <div className="flex items-center gap-2 text-[11.5px] bg-blue-950/30 p-2.5 rounded-lg border border-sky-600/20 text-sky-200 font-medium">
              <span>💡</span>
              <span>
                Based on patient's current presentation <b>({guidanceData.chief_complaint?.replace(/parent:[^;]+;\s*/, "") || "Fever & cough"})</b>
                {guidanceData.patient_original_reason && guidanceData.patient_original_reason !== guidanceData.chief_complaint && (
                  <span className="text-[11px] text-amber-300 ml-1">
                    (Patient originally reported: <i>"{guidanceData.patient_original_reason}"</i>)
                  </span>
                )}, active lab diagnostic reports ({guidanceData.ai_diagnostics_evaluated?.map((d: any) => d.test_name).join(", ") || "None"}), and medical history, here are the AI-suggested generic formulations:
              </span>
            </div>
            {/* One-click prefill of in-stock recommended medicines */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
              <span className="text-[11px] font-medium text-emerald-200">
                {availableCount > 0
                  ? `${availableCount} recommended medicine${availableCount > 1 ? "s are" : " is"} available in pharmacy stock.`
                  : "None of the recommended generics are currently in pharmacy stock."}
              </span>
              <button
                type="button"
                onClick={prefillAvailable}
                disabled={availableCount === 0}
                className="btn cyan text-[11px] !py-1 !px-3 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <Plus size={13} /> Prefill available into form
              </button>
            </div>
            {/* Suggested Generic Formulas List */}
            <div className="space-y-2 pt-1">
              <h5 className="font-semibold text-slate-300 text-xs">Generic Formula Recommendations for Clinical Consideration:</h5>
              {guidanceData.formula_recommendations?.map((f: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-sky-600/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-400 text-xs">{f.formula_name}</span>
                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-full bg-white/5">{f.category}</span>
                  </div>
                  <div className="mt-1 text-[11.5px] text-slate-200 font-mono">
                    <b>Active Formulations:</b> {f.active_ingredients}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-300">
                    <b>Dosage Guidance:</b> {f.dosage_guidance} | <b>Class:</b> {f.class}
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-400 italic">
                    💡 {f.clinical_rationale} ({f.safety_note})
                  </div>
                  {(() => {
                    const rows = availabilityFor(f);
                    const anyAvail = rows.some((r) => r.available);
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
                        {rows.map((r, ri) => (
                          <span
                            key={ri}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.available ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                          >
                            {r.available ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                            {r.available ? `In stock: ${r.stock_name}` : `${r.name}: not in stock`}
                          </span>
                        ))}
                        {anyAvail && (
                          <button
                            type="button"
                            onClick={() => addItemsToRx(rows)}
                            className="ml-auto btn ghost text-[10px] !py-0.5 !px-2 inline-flex items-center gap-1"
                          >
                            <Plus size={11} /> Add to Rx
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-bold text-slate-100" style={{ color: "#004578" }}>Prescription Form</h4>
          <div className="flex gap-1">
            <button type="button" className="chip" onClick={() => add({ drug_name: "Azithromycin 500mg", dose: "500 mg", frequency: "1-0-0", duration_days: 3 })}>+ Azithromycin</button>
            <button type="button" className="chip" onClick={() => add({ drug_name: "Paracetamol 650mg", dose: "650 mg", frequency: "SOS", duration_days: 5 })}>+ Paracetamol</button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--dim)] border border-dashed border-white/5 rounded-xl">
            No medications added yet. Click "+ Add" or use the preset buttons to start.
          </div>
        ) : (
          items.map((it, i) => {
            const searchVal = it.drug_name.toLowerCase().trim();
            const drugSuggestions = searchVal.length >= 2
              ? (stock || [])
                  .filter((s: any) => s.drug_name.toLowerCase().trimStart().startsWith(searchVal))
                  .sort((a: any, b: any) => a.drug_name.localeCompare(b.drug_name))
                  .slice(0, 8)
              : [];
            const matched = stock?.find((s: any) => {
              const nameLower = s.drug_name.toLowerCase().trim();
              return nameLower === searchVal;
            });
            const available = matched ? matched.available : 0;

            return (
              <div key={i} className="mb-3 p-3 rounded-xl border" style={{ borderColor: "var(--glass-border)", background: "rgba(255,255,255,0.01)" }}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_70px_70px_60px_28px]">
                  <div className="relative min-w-0">
                    <input
                      className="input w-full"
                      value={it.drug_name}
                      placeholder="Type 2 letters to search"
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={activeDrugInput === i && drugSuggestions.length > 0}
                      onFocus={() => setActiveDrugInput(i)}
                      onBlur={() => setActiveDrugInput((active) => active === i ? null : active)}
                      onChange={(e) => {
                        setItem(i, "drug_name", e.target.value);
                        setActiveDrugInput(i);
                      }}
                    />
                    {activeDrugInput === i && drugSuggestions.length > 0 && (
                      <div
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--line2)] bg-white shadow-xl"
                      >
                        {drugSuggestions.map((suggestion: any) => (
                          <button
                            type="button"
                            role="option"
                            key={suggestion.drug_name}
                            className="flex w-full items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[rgba(0,120,212,0.08)]"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectDrug(i, suggestion.drug_name);
                            }}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-[var(--ink)]">{suggestion.drug_name}</span>
                              <span className="block truncate text-[10px] text-[var(--muted)]">{suggestion.salt || suggestion.drug_class || "Medicine"}</span>
                            </span>
                            <span className={suggestion.available > 0 ? "shrink-0 font-semibold text-emerald-700" : "shrink-0 font-semibold text-rose-700"}>
                              {suggestion.available > 0 ? `${suggestion.available} available` : "Out of stock"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input className="input" value={it.dose} placeholder="Dose" onChange={(e) => setItem(i, "dose", e.target.value)} />
                  <input className="input" value={it.frequency} placeholder="Freq" onChange={(e) => setItem(i, "frequency", e.target.value)} />
                  <input className="input" type="number" value={it.duration_days ?? ""} placeholder="Days" onChange={(e) => setItem(i, "duration_days", e.target.value)} />
                  <button type="button" className="chip text-rose-400 border-rose-500/10 hover:bg-rose-950/15" onClick={() => del(i)}><Trash2 size={14} /></button>
                </div>
                <input
                  className="input w-full mt-2"
                  value={it.instructions ?? ""}
                  placeholder="Instructions (e.g. after food, avoid alcohol)"
                  onChange={(e) => setItem(i, "instructions", e.target.value)}
                />
                
                {it.drug_name.trim() && (
                  <div className="mt-1.5 px-1 flex items-center justify-between text-[11px]">
                    {matched ? (
                      <span className={available > 0 ? "text-[var(--mint)] font-medium" : "text-rose-400 font-semibold"}>
                        {available > 0 ? `✓ In stock: ${available} left` : "⚠ OUT OF STOCK"} 
                        <span className="text-[var(--dim)] ml-1.5">({matched.salt})</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold">⚠ Not found in stock</span>
                    )}
                    {matched && !matched.formulary && (
                      <span className="text-amber-500 font-bold uppercase text-[9px] tracking-wider">Non-Formulary</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {err && <div className="alertbox mt-2 text-rose-400 border-rose-500/10 bg-rose-950/5">{err}</div>}
        
        <div className="flex gap-2 mt-4 pt-2 border-t border-white/5">
          <button type="button" className="btn ghost" onClick={() => add()}><Plus size={15} /> Add Medication</button>
          {items.length > 0 ? (
            <button type="button" className="btn flex-1 justify-center" disabled={busy} onClick={() => runCds(items)}><Pill size={15} /> {busy ? "Analyzing..." : "Analyze & Run CDS"}</button>
          ) : (
            <button type="button" className="btn flex-1 g justify-center" disabled={busy} onClick={approveNoMeds}><BadgeCheck size={16} /> E-Sign (No Meds)</button>
          )}
        </div>

        {done && (
          <div className="space-y-3 mt-4 pt-4 border-t border-dashed border-white/10 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--mint)" }}>
              <CheckCircle2 size={18} /> Approved &amp; e-signed. Prescription finalized.
            </div>
          </div>
        )}

      </Card>

      {savedPrescription?.items?.length > 0 && (
        <Card className="mt-4 space-y-3 border border-[var(--cyan)]/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-100">Saved Prescription — This Visit</h4>
              <p className="mt-0.5 text-[11px] text-[var(--dim)]">
                Persisted against the current encounter only.
              </p>
            </div>
            <span className="tag blue">{savedPrescription.status}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-white/[0.03] text-[var(--dim)]">
                <tr>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Dose</th>
                  <th className="px-3 py-2">Frequency</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Instructions</th>
                  <th className="px-3 py-2">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {savedPrescription.items.map((item: any, index: number) => (
                  <tr key={`${item.drug_name}-${index}`} className="border-t border-white/5 text-slate-200">
                    <td className="px-3 py-2.5 font-semibold text-white">{item.drug_name}</td>
                    <td className="px-3 py-2.5">{item.dose || "—"}</td>
                    <td className="px-3 py-2.5">{item.frequency || "—"}</td>
                    <td className="px-3 py-2.5">{item.duration_days ? `${item.duration_days} days` : "—"}</td>
                    <td className="px-3 py-2.5">{item.instructions || "—"}</td>
                    <td className="px-3 py-2.5">{item.quantity ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canDischarge && !dischargeResult && (
        <Card className="mt-4 space-y-2 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 size={17} /> Consultation and prescription are complete.
          </div>
          <button
            type="button"
            className="btn w-full justify-center"
            disabled={discharging}
            onClick={completeAndDischarge}
          >
            <CheckCircle2 size={17} />
            {discharging ? "Completing Visit..." : "Complete & Discharge"}
          </button>
          {dischargeError && <div className="alertbox text-rose-400">{dischargeError}</div>}
        </Card>
      )}

      {dischargeResult && (
        <Card className="mt-4 space-y-3 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 size={17} /> Patient discharged. Prescription and discharge summary sent to the patient app.
          </div>
          {dischargeResult.compliance?.result?.gaps?.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-[13px] font-bold text-amber-400">
                <AlertTriangle size={15} /> Compliance gaps noted (discharge still went through)
              </div>
              <ul className="list-inside list-disc text-[12.5px] text-amber-200/90">
                {dischargeResult.compliance.result.gaps.map((gap: any, i: number) => (
                  <li key={i}><b>{gap.area}:</b> {gap.detail}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" className="btn ghost w-full justify-center" onClick={onDischarged}>
            Return to queue
          </button>
        </Card>
      )}
    </div>
  );
}
