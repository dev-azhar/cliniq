import { Clipboard, FileText, Download } from "lucide-react";
import { Card, Tag } from "../../../components/ui";

interface VitalsAndLabsProps {
  latestVitals?: any;
  orders?: any[];
}

export default function VitalsAndLabs({ latestVitals, orders }: VitalsAndLabsProps) {
  const measurement = (value: unknown, unit: string) =>
    value === null || value === undefined || value === "" ? "Not recorded" : `${value} ${unit}`;

  return (
    <Card className="space-y-3 animate-in fade-in duration-300">
      <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: "#004578" }}>
        <Clipboard size={16} className="text-[var(--cyan)]" /> Vitals &amp; Labs
      </h4>
      {latestVitals && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>BP</small><br /><b>{latestVitals.bp}</b></div>
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>SpO₂</small><br /><b>{latestVitals.spo2}%</b></div>
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>HR</small><br /><b>{latestVitals.heart_rate}</b></div>
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>Temp</small><br /><b>{latestVitals.temperature}°F</b></div>
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>Weight</small><br /><b>{measurement(latestVitals.weight_kg, "kg")}</b></div>
          <div className="holo text-center"><small style={{ color: "var(--dim)" }}>Height</small><br /><b>{measurement(latestVitals.height_cm, "cm")}</b></div>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="mt-3">
          <div className="font-bold text-xs text-[var(--dim)] mb-1 uppercase">Laboratory Results:</div>
          {orders.map((o: any) => (
            <div key={o.lab_order_id} className="p-2 border rounded-xl mb-1 text-xs" style={{ borderColor: "var(--glass-border)", background: "rgba(255,255,255,0.01)" }}>
              <div className="font-semibold text-slate-200">
                {o.test} — <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{o.status}</span>
              </div>
              {o.results?.map((r: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-[11px] mt-1 text-slate-300">
                  <span style={{ color: "var(--muted)" }}>• {r.analyte}</span>
                  <b>{r.value} {r.unit} {r.flag !== "N" && `(${r.flag})`}</b>
                </div>
              ))}
              {o.notes && !o.notes.includes("LOCAL PYTORCH") && (
                <div className="mt-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-0.5">Lab Findings:</span>
                  <span className="whitespace-pre-line text-slate-200">{o.notes}</span>
                </div>
              )}
              {o.attachment_uri && (
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-[var(--muted)] flex items-center gap-1 truncate max-w-[180px]">
                    <FileText size={12} className="shrink-0" /> {o.attachment_name || "Diagnostic Report"}
                  </span>
                  <a 
                    href={o.attachment_uri.startsWith("http") ? o.attachment_uri : `${import.meta.env.VITE_API_BASE_URL ?? ""}${o.attachment_uri}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--cyan)] hover:underline font-semibold shrink-0"
                  >
                    <Download size={11} /> View Report
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
