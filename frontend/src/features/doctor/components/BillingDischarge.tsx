import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api } from "../../../lib/api";
import { Card, Tag, Empty } from "../../../components/ui";

interface BillingDischargeProps {
  encounterId: string;
  onDischarged?: () => void;
  onBack?: () => void;
}

export default function BillingDischarge({ 
  encounterId, 
  onDischarged, 
  onBack 
}: BillingDischargeProps) {
  const { data: inv } = useQuery({ 
    queryKey: ["invoice", encounterId], 
    queryFn: () => api.invoice(encounterId) 
  });
  const [busy, setBusy] = useState(false);
  const [discharge, setDischarge] = useState<any>(null);

  async function doDischarge() {
    setBusy(true);
    try { 
      const res = await api.discharge(encounterId);
      setDischarge(res); 
      if (onDischarged) onDischarged();
    }
    catch (err: any) {
      alert(err?.message || "Failed to discharge patient.");
    }
    finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 animate-in fade-in duration-300">
      <Card>
        <h4 className="mb-2 font-bold text-slate-100" style={{ color: "#004578" }}>Invoice</h4>
        {!inv ? <Empty>Loading…</Empty> : (
          <>
            {inv.lines.map((l: any, i: number) => (
              <div key={i} className="kv"><span>{l.description}</span><b>₹{l.amount.toFixed(0)}</b></div>
            ))}
            {inv.insurance_adj > 0 && <div className="kv"><span>Insurance adjustment</span><b style={{ color: "var(--mint)" }}>−₹{inv.insurance_adj.toFixed(0)}</b></div>}
            <div className="kv text-base"><span>Balance</span><b className="grad-text">₹{inv.balance.toFixed(0)}</b></div>
            <div className="mt-1"><Tag tone={inv.status === "PAID" ? "green" : "amber"}>{inv.status}</Tag></div>
            <div className="mt-3.5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-semibold flex flex-col gap-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-emerald-400" /> PAID IN FULL
              </div>
              <div className="text-[11px] text-slate-300 mt-1">Paid via UPI / Online Payment at booking confirmation.</div>
            </div>
          </>
        )}
      </Card>

      <Card>
        <h4 className="mb-2 font-bold text-slate-100" style={{ color: "#004578" }}>Discharge</h4>
        {!discharge ? (
          <>
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Documentation completeness is checked before closure, then the discharge bundle is pushed to the ABDM PHR.</p>
            <button className="btn mt-3 w-full" disabled={busy} onClick={doDischarge}>Complete &amp; Discharge</button>
          </>
        ) : (
          <div className="space-y-2">
            {discharge.compliance.result.complete ? (
              <div className="flex items-center gap-2 text-emerald-400" style={{ color: "var(--mint)" }}><CheckCircle2 size={16} /> Compliance complete — no gaps.</div>
            ) : (
              <div className="alertbox">Open gaps: {discharge.compliance.result.gaps.map((g: any) => g.area).join(", ")}</div>
            )}
            <div className="holo text-[12.5px] text-slate-200">
              <div className="mb-1"><b>Diagnosis:</b> {discharge.discharge_summary.diagnosis?.map((d: any) => d.label || d.code || d).join(", ") || "—"}</div>
              <div className="mb-1"><b>Medications:</b> {discharge.discharge_summary.medications?.join("; ") || "—"}</div>
              <div className="mb-1"><b>Tests Ordered:</b> {discharge.discharge_summary.tests?.join(", ") || "—"}</div>
              <div><b>Follow-up:</b> {discharge.discharge_summary.follow_up}</div>
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>PHR: {discharge.discharge_summary.phr_uri}</div>
            <Tag tone="green">DISCHARGED</Tag>
            
            <button 
              onClick={onBack}
              className="btn w-full mt-4"
              style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
            >
              Close Visit &amp; Return to Queue
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
