import { Activity, CheckCircle2 } from "lucide-react";
import { Card } from "../../../components/ui";

const STAGES = [
  { label: "Checked in", msg: "You're checked in. Please stay nearby — no need to queue." },
  { label: "Triaged · token issued", msg: "Triage complete. We'll guide you to your room when it's time." },
  { label: "With the doctor", msg: "You're with the doctor. Your visit is being documented securely." },
  { label: "Diagnostics", msg: "Tests ordered — walk straight to the lab, reports attach automatically." },
  { label: "Under review", msg: "Awaiting lab values to update clinical decision trees." },
  { label: "Rx e-signed", msg: "Prescription complete. Proceed to pharmacy desk." },
  { label: "Discharged", msg: "Visit complete. Your PHR record is synchronized." },
];

interface StageTrackerProps {
  stage: number;
  token?: {
    number: string;
    room?: string;
    floor?: string;
    eta_minutes?: number;
  } | null;
}

export default function StageTracker({ stage, token }: StageTrackerProps) {
  const activeStage = Math.min(Math.max(stage, 0), STAGES.length - 1);

  return (
    <Card className="animate-in overflow-hidden fade-in duration-300">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="grad-text text-base font-extrabold flex items-center gap-1.5">
          <Activity size={16} /> Live Visit Tracker
        </h3>
        {token && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-left text-xs sm:text-right">
            <span className="text-[10px]" style={{ color: "var(--dim)" }}>QUEUE TOKEN:</span> <b>{token.number}</b>
            {token.room && <span className="text-[11px] text-[var(--cyan)] block">{token.room} ({token.floor})</span>}
          </div>
        )}
      </div>

      <div className="md:hidden">
        <div className="relative grid grid-cols-7 px-1 pt-1" aria-label={`Visit progress: ${STAGES[activeStage].label}`}>
          <div className="absolute left-[7%] right-[7%] top-4 h-px bg-[var(--line2)]" />
          <div
            className="absolute left-[7%] top-4 h-px bg-[var(--cyan)] transition-[width] duration-500"
            style={{ width: `${(activeStage / (STAGES.length - 1)) * 86}%` }}
          />
          {STAGES.map((item, index) => {
            const done = index < activeStage;
            const current = index === activeStage;
            return (
              <div className="relative z-10 flex min-w-0 flex-col items-center" key={item.label}>
                <div
                  className="grid h-7 w-7 place-items-center rounded-full border text-[10px] font-black"
                  style={{
                    borderColor: done || current ? "var(--cyan)" : "var(--line2)",
                    background: done || current ? "linear-gradient(150deg,var(--cyan),var(--violet))" : "var(--bg2)",
                    color: done || current ? "#ffffff" : "var(--dim)",
                    boxShadow: current ? "0 0 14px rgba(0,120,212,.55)" : "none",
                  }}
                  title={item.label}
                >
                  {done ? <CheckCircle2 size={13} /> : index + 1}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-3 py-2.5 text-center">
          <div className="text-xs font-extrabold text-white">
            {STAGES[activeStage].label}
            <span className="ml-2 text-[9px] uppercase tracking-wider text-[var(--cyan)]">Current</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{STAGES[activeStage].msg}</p>
        </div>
      </div>

      <div className="relative hidden text-center md:grid md:grid-cols-7 md:gap-2 xl:gap-3 2xl:gap-4">
        {STAGES.map((s, i) => {
          const done = i < activeStage;
          const current = i === activeStage;
          return (
            <div
              key={i}
              className={`min-w-0 flex min-h-[76px] flex-col items-center justify-between rounded-xl border px-1.5 py-2.5 text-[10px] transition lg:px-2 xl:min-h-[82px] xl:px-3 xl:text-[11px] 2xl:text-xs ${
                current
                  ? "border-[var(--cyan)] bg-[var(--cyan)]/5"
                  : "border-[var(--line2)]"
              }`}
              style={{ background: current ? "rgba(0,120,212,0.05)" : "var(--panel)" }}
            >
              <span className="mb-1 text-balance font-bold leading-tight" style={{ color: current ? "var(--ink)" : done ? "var(--muted)" : "var(--dim)" }}>
                {s.label}
              </span>
              <div 
                className="h-5 w-5 grid place-items-center rounded-full"
                style={{ background: done || current ? "linear-gradient(150deg,var(--cyan),var(--violet))" : "var(--line)" }}
              >
                {done ? <CheckCircle2 size={12} className="text-slate-900" /> : (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: current ? "white" : "var(--dim)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
