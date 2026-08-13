import { FileText } from "lucide-react";
import { Card } from "../../../components/ui";

interface ConsultationSummaryProps {
  encounterId: string;
  triage?: any;
  appointment?: any;
  notes?: string | null;      // General advice / consult notes
  note?: any;                 // Clinical SOAP note
}

export default function ConsultationSummary({ 
  encounterId, 
  triage, 
  appointment,
  notes,
  note 
}: ConsultationSummaryProps) {
  return (
    <Card className="space-y-3 animate-in fade-in duration-300">
      <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: "#004578" }}>
        <FileText size={16} className="text-[var(--cyan)]" /> Doctor Consultation Summary
      </h4>
      {triage && (
        <div className="holo p-2 text-xs text-slate-300">
          <b>Reason for Visit:</b> {triage.chief_complaint || appointment?.reason || "Not recorded"}
        </div>
      )}
      
      {/* General Consultation Notes & Advice */}
      {notes && (
        <div className="space-y-2 text-[12.5px]">
          <div className="p-3 rounded-xl border bg-white/5" style={{ borderColor: "var(--glass-border)" }}>
            <div className="font-semibold text-white mb-1">Doctor's Advice &amp; Instructions:</div>
            <p className="text-slate-200 whitespace-pre-line">
              {notes}
            </p>
          </div>
        </div>
      )}

      {/* SOAP Clinical Note / Diagnosis */}
      {note?.status === "APPROVED" && note.final_text && (
        <div className="space-y-2 text-[12.5px]">
          <div className="p-3 rounded-xl border bg-white/5" style={{ borderColor: "var(--glass-border)" }}>
            <div className="font-semibold text-white mb-1">Diagnosis &amp; Assessment:</div>
            <p className="text-slate-200 whitespace-pre-line">
              {note.final_text}
            </p>
          </div>
        </div>
      )}

      {!notes && (!note || note.status !== "APPROVED") && (
        <div className="text-xs italic text-[var(--dim)]">Consultation note is being finalized by your doctor.</div>
      )}
    </Card>
  );
}
