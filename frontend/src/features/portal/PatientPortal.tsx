import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  HeartPulse, Home, Calendar, FileText, FlaskConical, ScanLine, Pill, CreditCard,
  Shield, Users, ClipboardList, Sparkles, Settings, HelpCircle, LogOut, Search,
  Bell, MessageSquare, ChevronDown, Clock, MapPin, CalendarPlus, CheckCircle2, Circle,
  TriangleAlert, Video, RefreshCw, Download, Building2, Mic, Phone, Heart, Navigation,
  Info, ChevronRight, CalendarClock, XCircle, Stethoscope, Plus, Activity, Droplet,
  Loader2, UserPlus, Send, Lock, Globe, Target, Mail, ShieldCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import { usePortalSummary, type PortalSummary, type PortalAppointment } from "./portalApi";
import { getPortalSession, getPortalToken, clearPortalSession, portalInitials, fetchPortalMe } from "./portalSession";

const card = "rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(28,33,51,.05)]";

const NAV = [
  { label: "Home", icon: Home },
  { label: "Appointments", icon: Calendar },
  { label: "Health Records", icon: FileText },
  { label: "Lab Reports", icon: FlaskConical },
  { label: "Radiology", icon: ScanLine },
  { label: "Medications", icon: Pill },
  { label: "Billing & Payments", icon: CreditCard },
  { label: "Insurance", icon: Shield },
  { label: "Family Health", icon: Users },
  { label: "Care Plan", icon: ClipboardList },
  { label: "AI Assistant", icon: Sparkles },
];

const ASSISTANT_CHIPS = [
  "Explain my latest lab report",
  "Book an appointment",
  "What medicines should I take?",
  "Do I need a follow-up?",
  "Any health tips for me?",
];

/* ------------------------------------------------------------------- helpers */

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function labTone(status: string) {
  const t = status.toLowerCase();
  if (t.includes("critical") || t.includes("very")) return "#D13438";
  if (t.includes("high") || t.includes("low") || t.includes("border") || t.includes("abnormal")) return "#CA5010";
  if (t.includes("normal")) return "#16a34a";
  return "#0078d4";
}

function apptTone(status: string) {
  const t = status.toLowerCase();
  if (t.includes("cancel")) return "#D13438";
  if (t.includes("complete") || t.includes("discharge") || t.includes("checked out")) return "#64748b";
  if (t.includes("pending") || t.includes("triage") || t.includes("book") || t.includes("schedul")) return "#CA8A04";
  return "#16a34a";
}

function riskScore(risk?: string) {
  if (risk === "High") return 58;
  if (risk === "Moderate") return 74;
  return 90;
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: ComponentType<{ size?: number | string }>; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition"
      style={{ color: active ? "#0a5aa8" : "#475569", background: active ? "rgba(0,120,212,.09)" : "transparent" }}>
      <Icon size={17} /> <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function SectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
      {action && <button type="button" className="text-[11px] font-semibold text-[#0078d4]">{action} ›</button>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: ComponentType<{ size?: number | string }>; title: string; sub: string }) {
  return (
    <div className={`${card} grid place-items-center gap-2 p-10 text-center`}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon size={22} /></span>
      <div className="text-[13.5px] font-bold text-slate-700">{title}</div>
      <div className="text-[12px] text-slate-400">{sub}</div>
    </div>
  );
}

function PageHead({ title, sub, cta }: { title: string; sub: string; cta?: { label: string; icon: ComponentType<{ size?: number | string }>; onClick?: () => void } }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-800">{title}</h1>
        <p className="text-[13px] text-slate-500">{sub}</p>
      </div>
      {cta && (
        <button type="button" onClick={cta.onClick} className="flex items-center gap-1.5 rounded-xl bg-[#0078d4] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm">
          <cta.icon size={16} /> {cta.label}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- HOME */

function HomeView({ s, name, go }: { s?: PortalSummary; name: string; go: (label: string) => void }) {
  const score = riskScore(s?.riskLevel);
  const scoreTone = score >= 80 ? "#16a34a" : score >= 65 ? "#CA5010" : "#D13438";
  const nextAppt = s?.appointments.upcoming[0];
  const labs = s?.labs ?? [];
  const meds = s?.medications ?? [];
  const problems = s?.problems ?? [];

  const stats = [
    { icon: Calendar, tint: "#0078d4", big: nextAppt ? nextAppt.time : "—", note: nextAppt ? nextAppt.date : "None scheduled", cta: "View", go: "Appointments" },
    { icon: Pill, tint: "#16a34a", big: String(meds.length), note: "Active medications", cta: "View All", go: "Medications" },
    { icon: FileText, tint: "#8764B8", big: String(labs.length), note: "Lab reports", cta: "View", go: "Lab Reports" },
    { icon: CreditCard, tint: "#CA5010", big: s?.billing.outstanding ?? "₹ 0", note: "Outstanding bill", cta: "Pay Now", go: "Billing & Payments" },
    { icon: Bell, tint: "#0891b2", big: String(problems.length), note: "Health reminders", cta: "View", go: "Health Records" },
  ];

  const alerts = problems.length
    ? [
        ...(s && s.abnormalLabs > 0 ? [{ icon: TriangleAlert, tone: "#D13438", title: "Abnormal lab results", body: `${s.abnormalLabs} value(s) out of range`, date: labs[0]?.date?.split(",")[0] ?? "" }] : []),
        ...problems.slice(0, 3).map((p) => ({ icon: Info, tone: "#CA5010", title: p.name, body: p.onset || "Active problem — monitor", date: "" })),
      ]
    : [
        { icon: TriangleAlert, tone: "#D13438", title: "Follow-up Due", body: "Cardiology follow-up in 7 days", date: "" },
        { icon: Info, tone: "#0078d4", title: "Vaccine Due", body: "Flu vaccine is due", date: "" },
      ];

  const journeyStatus = (s?.status || "CHECKED_IN").toUpperCase();
  const jIdx: Record<string, number> = { REGISTERED: 0, CHECKED_IN: 1, TRIAGED: 2, IN_CONSULT: 2, ADMITTED: 2, COMPLETED: 6, DISCHARGED: 6, CHECKED_OUT: 6 };
  const cur = jIdx[journeyStatus] ?? 2;
  const journey = ["Registration", "Check-In", "Consultation", "Lab Tests", "Pharmacy", "Billing", "Follow-up"]
    .map((label, i) => ({ label, state: i < cur ? "done" : i === cur ? "current" : "todo" }));

  const tasks = [
    ...meds.slice(0, 1).map((m) => ({ label: `Take ${m.name}`, meta: m.dose || "As prescribed" })),
    ...(s && s.billing.outstandingRaw > 0 ? [{ label: "Pay outstanding bill", meta: s.billing.outstanding }] : []),
    ...(nextAppt ? [{ label: `Visit ${nextAppt.dr}`, meta: `${nextAppt.date}, ${nextAppt.time}` }] : []),
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-800">Good day, {firstName(name)}! 👋</h1>
            <p className="text-[13px] text-slate-500">Here's your health summary for today.</p>
          </div>
          <div className={`${card} flex items-center gap-3 p-3`}>
            <div className="flex items-center gap-2">
              <Heart size={18} style={{ color: scoreTone }} fill={scoreTone} />
              <div><div className="text-[10px] font-semibold text-slate-400">AI Health Score</div><div className="text-[20px] font-extrabold leading-none text-slate-800">{score} <span className="text-[11px] font-medium text-slate-400">/100</span></div></div>
            </div>
            <div className="h-8 w-px bg-black/[0.06]" />
            <div><div className="text-[12px] font-bold" style={{ color: scoreTone }}>{score >= 80 ? "Great job! 🎉" : score >= 65 ? "Keep going 💪" : "Needs attention"}</div><div className="text-[10.5px] text-slate-400">Based on your records.</div></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((st) => (
            <div key={st.note} className={`${card} p-3.5`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${st.tint}15`, color: st.tint }}><st.icon size={17} /></span>
              </div>
              <div className="text-[19px] font-extrabold leading-none text-slate-800">{st.big}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{st.note}</div>
              <button type="button" onClick={() => go(st.go)} className="mt-2 flex items-center gap-0.5 text-[11px] font-semibold text-[#0078d4]">{st.cta} <ChevronRight size={12} /></button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className={`${card} p-4`}>
            <h3 className="mb-3 text-[13.5px] font-bold text-slate-800">Upcoming Appointment</h3>
            {nextAppt ? (
              <>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0c3b63] text-[16px] font-bold text-white">{nextAppt.init}</span>
                    <div>
                      <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-800">{nextAppt.dr} <CheckCircle2 size={14} className="text-[#0078d4]" /></div>
                      <div className="text-[12px] text-slate-500">{nextAppt.spec}</div>
                      <div className="mt-1.5 flex gap-1.5">
                        <span className="rounded-md bg-[rgba(0,120,212,.1)] px-2 py-0.5 text-[10px] font-semibold text-[#0a5aa8]">{nextAppt.visitType}</span>
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${apptTone(nextAppt.status)}15`, color: apptTone(nextAppt.status) }}>{nextAppt.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 text-[12px] text-slate-600">
                    <div className="flex items-center gap-2"><Calendar size={13} className="text-slate-400" /> {nextAppt.date}</div>
                    <div className="flex items-center gap-2"><Clock size={13} className="text-slate-400" /> {nextAppt.time}</div>
                    <div className="flex items-center gap-2">{nextAppt.mode === "Video" ? <Video size={13} className="text-slate-400" /> : <MapPin size={13} className="text-slate-400" />} {nextAppt.loc}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0078d4] py-2.5 text-[12px] font-semibold text-white"><CheckCircle2 size={14} /> Check-In</button>
                  <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><Calendar size={14} /> Reschedule</button>
                  <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><Navigation size={14} /> Directions</button>
                  <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><CalendarPlus size={14} /> Add to Calendar</button>
                </div>
              </>
            ) : (
              <div className="grid place-items-center gap-2 py-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Calendar size={20} /></span>
                <div className="text-[12.5px] font-semibold text-slate-600">No upcoming appointments</div>
                <button type="button" onClick={() => go("Appointments")} className="rounded-xl bg-[#0078d4] px-3 py-1.5 text-[11.5px] font-semibold text-white">Book Appointment</button>
              </div>
            )}
          </div>

          <div className={`${card} p-4`}>
            <SectionHead title="My Health Journey" action="View All" />
            <div className="space-y-0">
              {journey.map((j, i) => (
                <div key={j.label} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    {j.state === "done" ? <CheckCircle2 size={18} className="text-[#16a34a]" /> : j.state === "current" ? <span className="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-[#0078d4]"><span className="h-1.5 w-1.5 rounded-full bg-[#0078d4]" /></span> : <Circle size={18} className="text-slate-300" />}
                    {i < journey.length - 1 && <span className="my-0.5 h-5 w-px" style={{ background: j.state === "done" ? "#16a34a" : "#e2e8f0" }} />}
                  </div>
                  <div className="-mt-0.5 flex flex-1 items-center pb-1">
                    <span className="text-[12.5px] font-semibold" style={{ color: j.state === "todo" ? "#94a3b8" : "#334155" }}>{j.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className={`${card} p-4`}>
            <SectionHead title="Recent Lab Results" action="View All" />
            {labs.length ? (
              <div className="space-y-2">
                {labs.slice(0, 4).map((l, i) => (
                  <div key={`${l.test}-${i}`} className="flex items-center justify-between gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                    <div><div className="text-[12.5px] font-semibold text-slate-700">{l.test}</div><div className="text-[10px] text-slate-400">{l.date}</div></div>
                    <div className="flex items-center gap-2">{l.value && <span className="text-[11.5px] font-semibold text-slate-600">{l.value}</span>}<span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${labTone(l.status)}15`, color: labTone(l.status) }}>{l.status}</span></div>
                  </div>
                ))}
              </div>
            ) : <div className="py-4 text-center text-[12px] text-slate-400">No lab results yet.</div>}
            <button type="button" onClick={() => go("Lab Reports")} className="mt-2 text-[11px] font-semibold text-[#0078d4]">View All Reports ›</button>
          </div>

          <div className={`${card} p-4`}>
            <SectionHead title="Active Medications" action="View All" />
            {meds.length ? (
              <div className="space-y-2">
                {meds.slice(0, 4).map((m, i) => (
                  <div key={`${m.name}-${i}`} className="flex items-center justify-between gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                    <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Pill size={13} /></span><span className="text-[12.5px] font-semibold text-slate-700">{m.name}</span></div>
                    <div className="text-[10.5px] text-slate-400">{m.dose}</div>
                  </div>
                ))}
              </div>
            ) : <div className="py-4 text-center text-[12px] text-slate-400">No active medications.</div>}
            <button type="button" onClick={() => go("Medications")} className="mt-2 text-[11px] font-semibold text-[#0078d4]">Refill Medicines ›</button>
          </div>

          <div className={`${card} p-4`}>
            <SectionHead title="Health Alerts" action="View All" />
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={`${a.title}-${i}`} className="flex items-start gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                  <a.icon size={15} className="mt-0.5 shrink-0" style={{ color: a.tone }} />
                  <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-slate-700">{a.title}</div><div className="text-[10.5px] text-slate-500">{a.body}</div></div>
                  {a.date && <span className="shrink-0 text-[9.5px] text-slate-400">{a.date}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className={`${card} p-4`}>
            <SectionHead title="Insurance Summary" action="View Details" />
            <div className="grid grid-cols-2 gap-y-2.5">
              {[["Policy Number", "HDFX-987654321"], ["Coverage Left", "₹ 3.20 L"], ["Valid Till", "Dec 31, 2026"], ["Claim Status", "Approved"]].map(([k, v]) => (
                <div key={k}><div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="text-[12px] font-semibold" style={{ color: v === "Approved" ? "#16a34a" : "#334155" }}>{v}</div></div>
              ))}
            </div>
          </div>

          <div className={`${card} p-4`}>
            <SectionHead title="Upcoming Tasks" action="View All" />
            {tasks.length ? (
              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <label key={`${t.label}-${i}`} className="flex items-center gap-2.5">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-[#0078d4]" />
                    <span className="flex-1 text-[12px] text-slate-600">{t.label}</span>
                    <span className="text-[10.5px] font-semibold text-slate-400">{t.meta}</span>
                  </label>
                ))}
              </div>
            ) : <div className="py-4 text-center text-[12px] text-slate-400">You're all caught up 🎉</div>}
          </div>

          <div className={`${card} p-4`}>
            <SectionHead title="Health Tips for You" action="View All" />
            <p className="text-[12px] leading-relaxed text-slate-600">Walk for 30 minutes daily to keep your heart healthy. Drink at least 8 glasses of water every day and take medicines on time.</p>
          </div>
        </div>
      </div>

      <RightRail name={name} go={go} />
    </div>
  );
}

/* ---------------------------------------------------------------- RIGHT RAIL */

function RightRail({ name, go }: { name: string; go: (label: string) => void }) {
  const quick = [
    { icon: Calendar, label: "Book Appointment", go: "Appointments" },
    { icon: Video, label: "Teleconsult", go: "Appointments" },
    { icon: RefreshCw, label: "Refill Medicine", go: "Medications" },
    { icon: CreditCard, label: "Pay Bill", go: "Billing & Payments" },
    { icon: Download, label: "Download Reports", go: "Lab Reports" },
    { icon: Building2, label: "Find Hospital", go: "Home" },
  ];
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-col p-4`}>
        <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#7c3aed,#4f46e5)" }}><Sparkles size={16} /></span><div><div className="text-[13px] font-bold text-slate-800">AI Health Assistant</div><span className="rounded bg-[rgba(124,58,237,.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#7c3aed]">BETA</span></div></div>
        <div className="mb-3 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600"><b className="text-slate-700">Hello {firstName(name)}! 👋</b><br />I can help you with</div>
        <div className="space-y-1.5">
          {ASSISTANT_CHIPS.map((c) => (
            <button key={c} type="button" className="w-full rounded-xl border border-black/[0.07] bg-white px-3 py-2 text-left text-[12px] font-medium text-slate-600 hover:border-[#7c3aed]/40 hover:text-[#5b21b6]">{c}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2">
          <input className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Ask anything..." />
          <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(150deg,#7c3aed,#4f46e5)" }}><Mic size={14} /></button>
        </div>
      </div>

      <div className={`${card} p-4`}>
        <h3 className="mb-3 text-[13px] font-bold text-slate-800">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={() => go(q.go)} className="flex flex-col items-center gap-1.5 rounded-xl border border-black/[0.06] bg-slate-50/60 px-1 py-3 text-center hover:border-[#0078d4]/30">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><q.icon size={16} /></span>
              <span className="text-[9.5px] font-semibold leading-tight text-slate-600">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} p-4`}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-800">Need Help?</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><MessageSquare size={15} /></span><div><div className="text-[12px] font-semibold text-slate-700">Chat with Support</div><div className="text-[10px] text-slate-400">Available 24/7</div></div></div>
          <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Phone size={15} /></span><div><div className="text-[12px] font-semibold text-slate-700">Call Us</div><div className="text-[10px] text-slate-400">+91 98765 43210</div></div></div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- APPOINTMENTS */

function ApptCard({ a }: { a: PortalAppointment }) {
  const past = !a.upcoming;
  return (
    <div className={`${card} p-4`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[14px] font-bold text-white" style={{ background: "#0c3b63" }}>{a.init}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-slate-800">{a.dr} <CheckCircle2 size={13} className="text-[#0078d4]" /></div>
          <div className="text-[11.5px] text-slate-500">{a.spec}</div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
            <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> {a.date}</span>
            <span className="flex items-center gap-1"><Clock size={12} className="text-slate-400" /> {a.time}</span>
            <span className="flex items-center gap-1">{a.mode === "Video" ? <Video size={12} className="text-slate-400" /> : <MapPin size={12} className="text-slate-400" />} {a.loc}</span>
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${apptTone(a.status)}15`, color: apptTone(a.status) }}>{a.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {past ? (
          <>
            <button type="button" className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-600"><FileText size={13} /> View Summary</button>
            <button type="button" className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-600"><Download size={13} /> Prescription</button>
            <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[#0078d4] px-3 py-2 text-[11.5px] font-semibold text-white"><CalendarPlus size={13} /> Book Follow-up</button>
          </>
        ) : (
          <>
            {a.mode === "Video"
              ? <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[#0078d4] px-3 py-2 text-[11.5px] font-semibold text-white"><Video size={13} /> Join Call</button>
              : <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[#0078d4] px-3 py-2 text-[11.5px] font-semibold text-white"><CheckCircle2 size={13} /> Check-In</button>}
            <button type="button" className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-600"><Calendar size={13} /> Reschedule</button>
            {a.mode !== "Video" && <button type="button" className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-600"><Navigation size={13} /> Directions</button>}
            <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[#D13438]/30 px-3 py-2 text-[11.5px] font-semibold text-[#D13438]"><XCircle size={13} /> Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function AppointmentsView({ s }: { s?: PortalSummary }) {
  const [tab, setTab] = useState<"Upcoming" | "Past">("Upcoming");
  const upcoming = s?.appointments.upcoming ?? [];
  const past = s?.appointments.past ?? [];
  const list = tab === "Upcoming" ? upcoming : past;
  const apptStats = [
    { icon: CalendarClock, tint: "#0078d4", label: "Upcoming", value: String(upcoming.length) },
    { icon: CheckCircle2, tint: "#16a34a", label: "Past Visits", value: String(past.length) },
    { icon: Stethoscope, tint: "#8764B8", label: "Care Team", value: String(s?.careTeam.length ?? 0) },
    { icon: XCircle, tint: "#D13438", label: "Cancelled", value: "0" },
  ];
  return (
    <div className="space-y-4">
      <PageHead title="My Appointments" sub="Manage your visits, teleconsults and follow-ups." cta={{ label: "Book Appointment", icon: Plus }} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {apptStats.map((st) => (
          <div key={st.label} className={`${card} flex items-center gap-3 p-3.5`}>
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${st.tint}15`, color: st.tint }}><st.icon size={18} /></span>
            <div><div className="text-[20px] font-extrabold leading-none text-slate-800">{st.value}</div><div className="text-[11px] text-slate-400">{st.label}</div></div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-2.5`}>
            <div className="flex gap-1">
              {(["Upcoming", "Past"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className="rounded-xl px-4 py-2 text-[12.5px] font-semibold transition"
                  style={{ background: tab === t ? "rgba(0,120,212,.1)" : "transparent", color: tab === t ? "#0a5aa8" : "#64748b" }}>{t}</button>
              ))}
            </div>
            <label className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-black/[0.08] bg-slate-50 px-3 text-slate-400 sm:max-w-[240px]">
              <Search size={14} /><input className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search appointments..." />
            </label>
          </div>
          {list.length === 0
            ? <EmptyState icon={Calendar} title={`No ${tab.toLowerCase()} appointments`} sub={`You have no ${tab.toLowerCase()} appointments right now.`} />
            : <div className="space-y-3">{list.map((a, i) => <ApptCard key={`${a.dr}-${i}`} a={a} />)}</div>}
        </div>
        <div className="space-y-4">
          <div className={`${card} p-4`}>
            <h3 className="mb-3 text-[13px] font-bold text-slate-800">Book New Appointment</h3>
            <div className="space-y-2.5">
              <div><div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Specialty</div>
                <select className="w-full rounded-xl border border-black/[0.08] bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700 outline-none">
                  {["Cardiology", "Endocrinology", "Dermatology", "General Physician", "Orthopedics", "Neurology"].map((sp) => <option key={sp}>{sp}</option>)}
                </select>
              </div>
              <div><div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Preferred Date</div>
                <input type="date" className="w-full rounded-xl border border-black/[0.08] bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700 outline-none" />
              </div>
              <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0078d4] py-2.5 text-[12.5px] font-semibold text-white"><Search size={14} /> Find Slots</button>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-800">Reminders</h3>
            <div className="space-y-2 text-[11.5px] text-slate-600">
              <div className="flex items-start gap-2"><Bell size={14} className="mt-0.5 text-[#0078d4]" /> Arrive 15 minutes early for check-in.</div>
              <div className="flex items-start gap-2"><FileText size={14} className="mt-0.5 text-[#16a34a]" /> Carry your previous reports and prescriptions.</div>
              <div className="flex items-start gap-2"><Shield size={14} className="mt-0.5 text-[#8764B8]" /> Keep your insurance card handy.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- LAB REPORTS */

function LabReportsView({ s }: { s?: PortalSummary }) {
  const labs = s?.labs ?? [];
  return (
    <div className="space-y-4">
      <PageHead title="Lab Reports" sub="Your test results with reference ranges and trends." cta={{ label: "Download All", icon: Download }} />
      {labs.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No lab reports" sub="Your lab results will appear here once available." />
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1.2fr] gap-2 border-b border-black/[0.06] bg-slate-50 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            <span>Test</span><span>Result</span><span>Reference</span><span>Status</span><span>Date</span>
          </div>
          {labs.map((l, i) => (
            <div key={`${l.test}-${i}`} className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_1.2fr] items-center gap-2 border-b border-black/[0.04] px-4 py-3 text-[12px] last:border-0">
              <span className="font-semibold text-slate-700">{l.test}</span>
              <span className="text-slate-600">{l.value || "—"}</span>
              <span className="text-slate-400">{l.range}</span>
              <span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${labTone(l.status)}15`, color: labTone(l.status) }}>{l.status}</span></span>
              <span className="text-slate-400">{l.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- MEDICATIONS */

function MedicationsView({ s }: { s?: PortalSummary }) {
  const meds = s?.medications ?? [];
  return (
    <div className="space-y-4">
      <PageHead title="Medications" sub="Your active prescriptions and refill status." cta={{ label: "Request Refill", icon: RefreshCw }} />
      {meds.length === 0 ? (
        <EmptyState icon={Pill} title="No active medications" sub="Prescribed medicines will show up here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {meds.map((m, i) => (
            <div key={`${m.name}-${i}`} className={`${card} p-4`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Pill size={19} /></span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-slate-800">{m.name}</div>
                  <div className="text-[11.5px] text-slate-500">{m.dose || "As prescribed"}</div>
                  <span className="mt-1.5 inline-block rounded-full bg-[rgba(22,163,74,.12)] px-2 py-0.5 text-[10px] font-bold text-[#16a34a]">Active</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="flex-1 rounded-xl bg-[#0078d4] py-2 text-[11.5px] font-semibold text-white">Refill</button>
                <button type="button" className="flex-1 rounded-xl border border-black/[0.08] py-2 text-[11.5px] font-semibold text-slate-600">Set Reminder</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ RADIOLOGY */

function RadiologyView({ s }: { s?: PortalSummary }) {
  const imaging = s?.imaging ?? [];
  return (
    <div className="space-y-4">
      <PageHead title="Radiology" sub="Imaging studies — scans, X-rays and reports." />
      {imaging.length === 0 ? (
        <EmptyState icon={ScanLine} title="No imaging studies" sub="Your radiology studies will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {imaging.map((im, i) => (
            <div key={`${im.name}-${i}`} className={`${card} p-4`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgba(135,100,184,.12)] text-[#8764B8]"><ScanLine size={19} /></span>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-bold text-slate-800">{im.name}</div>
                  <div className="text-[11.5px] text-slate-500">{im.type}</div>
                  <div className="text-[10.5px] text-slate-400">{im.date}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="flex-1 rounded-xl bg-[#0078d4] py-2 text-[11.5px] font-semibold text-white">View Study</button>
                {im.uri && <a href={im.uri} target="_blank" rel="noreferrer" className="flex-1 rounded-xl border border-black/[0.08] py-2 text-center text-[11.5px] font-semibold text-slate-600">Download</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- HEALTH RECORDS */

function HealthRecordsView({ s }: { s?: PortalSummary }) {
  const problems = s?.problems ?? [];
  const allergies = s?.allergies ?? [];
  const documents = s?.documents ?? [];
  const notes = s?.notes ?? [];
  const v = s?.vitals;
  return (
    <div className="space-y-4">
      <PageHead title="Health Records" sub="Your problems, allergies, vitals and documents." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} p-4`}>
          <SectionHead title="Vitals" />
          {v && (v.bp || v.hr) ? (
            <div className="grid grid-cols-2 gap-3">
              {[["BP", v.bp], ["Heart Rate", v.hr ? `${v.hr} bpm` : null], ["SpO₂", v.spo2 ? `${v.spo2}%` : null], ["Temp", v.temp ? `${v.temp}°` : null]].map(([k, val]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-semibold uppercase text-slate-400">{k}</div><div className="text-[15px] font-bold text-slate-800">{val ?? "—"}</div></div>
              ))}
            </div>
          ) : <div className="flex items-center gap-2 py-3 text-[12px] text-slate-400"><Activity size={14} /> No vitals recorded.</div>}
        </div>
        <div className={`${card} p-4`}>
          <SectionHead title="Problems" />
          {problems.length ? <ul className="space-y-2">{problems.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-start gap-2 text-[12.5px] text-slate-700"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CA5010]" /><div><div className="font-semibold">{p.name}</div>{p.onset && <div className="text-[10.5px] text-slate-400">{p.onset}</div>}</div></li>
          ))}</ul> : <div className="py-3 text-[12px] text-slate-400">No active problems.</div>}
        </div>
        <div className={`${card} p-4`}>
          <SectionHead title="Allergies" />
          {allergies.length ? <div className="flex flex-wrap gap-2">{allergies.map((a, i) => (
            <span key={`${a.substance}-${i}`} className="rounded-full bg-[rgba(209,52,56,.1)] px-2.5 py-1 text-[11px] font-semibold text-[#D13438]"><Droplet size={11} className="mr-1 inline" />{a.substance}{a.severity ? ` · ${a.severity}` : ""}</span>
          ))}</div> : <div className="py-3 text-[12px] text-slate-400">No known allergies.</div>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} p-4`}>
          <SectionHead title="Clinical Notes" />
          {notes.length ? <div className="space-y-2.5">{notes.slice(0, 5).map((n, i) => (
            <div key={i} className="border-b border-black/[0.04] pb-2.5 last:border-0"><div className="flex items-center justify-between"><span className="text-[12.5px] font-semibold text-slate-700">{n.kind}</span><span className="text-[10px] text-slate-400">{n.date}</span></div><div className="text-[11.5px] text-slate-500">{n.excerpt}</div><div className="mt-0.5 text-[10px] text-slate-400">— {n.author}</div></div>
          ))}</div> : <div className="py-3 text-[12px] text-slate-400">No clinical notes.</div>}
        </div>
        <div className={`${card} p-4`}>
          <SectionHead title="Documents" />
          {documents.length ? <div className="space-y-2">{documents.slice(0, 8).map((d, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-black/[0.04] pb-2 last:border-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><FileText size={14} /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold text-slate-700">{d.name}</div><div className="text-[10px] text-slate-400">{d.category} · {d.date}</div></div>
              {d.uri ? <a href={d.uri} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-semibold text-[#0078d4]">Open</a> : <span className="shrink-0 text-[11px] text-slate-300">—</span>}
            </div>
          ))}</div> : <div className="py-3 text-[12px] text-slate-400">No documents.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- BILLING */

function BillingView({ s }: { s?: PortalSummary }) {
  const billing = s?.billing;
  const invoices = billing?.invoices ?? [];
  return (
    <div className="space-y-4">
      <PageHead title="Billing & Payments" sub="Your invoices, balances and payment history." cta={{ label: "Pay Now", icon: CreditCard }} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Outstanding</div>
          <div className="mt-1 text-[24px] font-extrabold text-[#CA5010]">{billing?.outstanding ?? "₹ 0"}</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Invoices</div>
          <div className="mt-1 text-[24px] font-extrabold text-slate-800">{invoices.length}</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Insurance</div>
          <div className="mt-1 text-[15px] font-bold text-[#16a34a]">Cashless active</div>
        </div>
      </div>
      {invoices.length === 0 ? (
        <EmptyState icon={CreditCard} title="No invoices" sub="Your billing history will appear here." />
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="grid grid-cols-[1fr_1.2fr_1fr_1fr_0.9fr] gap-2 border-b border-black/[0.06] bg-slate-50 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            <span>Invoice</span><span>Date</span><span>Amount</span><span>Balance</span><span>Status</span>
          </div>
          {invoices.map((inv, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.2fr_1fr_1fr_0.9fr] items-center gap-2 border-b border-black/[0.04] px-4 py-3 text-[12px] last:border-0">
              <span className="font-semibold text-slate-700">{inv.invoice}</span>
              <span className="text-slate-400">{inv.date}</span>
              <span className="text-slate-600">{inv.gross}</span>
              <span className="font-semibold text-slate-700">{inv.balance}</span>
              <span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: apptTone(inv.status) + "15", color: apptTone(inv.status) }}>{inv.status}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- CARE PLAN */

function CarePlanView({ s }: { s?: PortalSummary }) {
  const problems = s?.problems ?? [];
  const meds = s?.medications ?? [];
  const team = s?.careTeam ?? [];
  const next = s?.appointments.upcoming[0];
  const goals = problems.length
    ? problems.map((p) => ({ title: `Manage ${p.name}`, detail: p.onset || "Keep under active control", pct: 60 }))
    : [{ title: "Maintain a healthy lifestyle", detail: "Balanced diet, exercise and regular check-ups", pct: 80 }];
  return (
    <div className="space-y-4">
      <PageHead title="Care Plan" sub="Your personalised goals, medications and next steps." />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <div className={`${card} p-4`}>
            <SectionHead title="Health Goals" />
            <div className="space-y-3">
              {goals.map((g, i) => (
                <div key={i} className="rounded-xl border border-black/[0.06] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><Target size={14} /></span><span className="text-[12.5px] font-semibold text-slate-700">{g.title}</span></div>
                    <span className="text-[11px] font-bold text-[#0078d4]">{g.pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#0078d4]" style={{ width: `${g.pct}%` }} /></div>
                  <div className="mt-1 text-[10.5px] text-slate-400">{g.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-4`}>
            <SectionHead title="Medication Plan" />
            {meds.length ? <div className="space-y-2">{meds.map((m, i) => (
              <div key={i} className="flex items-center justify-between border-b border-black/[0.04] pb-2 last:border-0">
                <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Pill size={13} /></span><span className="text-[12.5px] font-semibold text-slate-700">{m.name}</span></div>
                <span className="text-[10.5px] text-slate-400">{m.dose || "As prescribed"}</span>
              </div>
            ))}</div> : <div className="py-3 text-[12px] text-slate-400">No medications in your plan.</div>}
          </div>
        </div>
        <div className="space-y-4">
          <div className={`${card} p-4`}>
            <SectionHead title="Next Steps" />
            <div className="space-y-2.5 text-[12px] text-slate-600">
              {next ? <div className="flex items-start gap-2"><CalendarClock size={14} className="mt-0.5 shrink-0 text-[#0078d4]" /> <span>Attend your appointment with <b>{next.dr}</b> on {next.date}, {next.time}.</span></div> : <div className="flex items-start gap-2"><CalendarClock size={14} className="mt-0.5 shrink-0 text-[#0078d4]" /> Book a follow-up consultation.</div>}
              <div className="flex items-start gap-2"><FlaskConical size={14} className="mt-0.5 shrink-0 text-[#8764B8]" /> Repeat recommended lab tests before your next visit.</div>
              <div className="flex items-start gap-2"><Activity size={14} className="mt-0.5 shrink-0 text-[#16a34a]" /> 30 minutes of activity, 5 days a week.</div>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <SectionHead title="Care Team" />
            {team.length ? <div className="space-y-2.5">{team.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0c3b63] text-[11px] font-bold text-white">{portalInitials(t.name)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold text-slate-700">{t.name}</div><div className="text-[10.5px] text-slate-400">{t.role}</div></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-semibold text-slate-500">{t.badge}</span>
              </div>
            ))}</div> : <div className="py-3 text-[12px] text-slate-400">Care team not assigned yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- INSURANCE */

function InsuranceView({ s }: { s?: PortalSummary }) {
  const outstanding = s?.billing.outstanding ?? "₹ 0";
  const claims = [
    { id: "CLM-4471", hospital: "ClinIQ Main", date: "May 07, 2026", amount: "₹ 18,400", status: "Approved" },
    { id: "CLM-4390", hospital: "ClinIQ Main", date: "Apr 03, 2026", amount: "₹ 6,250", status: "Settled" },
    { id: "CLM-4302", hospital: "City Diagnostics", date: "Feb 21, 2026", amount: "₹ 2,100", status: "Processing" },
  ];
  return (
    <div className="space-y-4">
      <PageHead title="Insurance" sub="Your policy, coverage and claim history." cta={{ label: "Download e-Card", icon: Download }} />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between p-4 text-white" style={{ background: "linear-gradient(135deg,#0c3b63,#0078d4)" }}>
            <div><div className="text-[11px] opacity-80">Star Health · Family Floater</div><div className="text-[17px] font-extrabold">HDFX-987654321</div></div>
            <ShieldCheck size={30} className="opacity-90" />
          </div>
          <div className="grid grid-cols-2 gap-y-3 p-4 sm:grid-cols-4">
            {[["Sum Insured", "₹ 5.00 L"], ["Used", "₹ 1.80 L"], ["Balance", "₹ 3.20 L"], ["Valid Till", "Dec 31, 2026"]].map(([k, v]) => (
              <div key={k}><div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="text-[13px] font-bold text-slate-800">{v}</div></div>
            ))}
          </div>
        </div>
        <div className={`${card} p-4`}>
          <SectionHead title="Coverage" />
          <div className="space-y-2 text-[12px] text-slate-600">
            {["Cashless hospitalization", "Pre & post hospitalization (60 days)", "Day-care procedures", "Annual health check-up"].map((c) => (
              <div key={c} className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#16a34a]" /> {c}</div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11.5px]"><span className="text-slate-400">Current outstanding</span><div className="text-[15px] font-bold text-[#CA5010]">{outstanding}</div></div>
        </div>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-[1fr_1.2fr_1fr_1fr_0.9fr] gap-2 border-b border-black/[0.06] bg-slate-50 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400"><span>Claim</span><span>Hospital</span><span>Date</span><span>Amount</span><span>Status</span></div>
        {claims.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_1.2fr_1fr_1fr_0.9fr] items-center gap-2 border-b border-black/[0.04] px-4 py-3 text-[12px] last:border-0">
            <span className="font-semibold text-slate-700">{c.id}</span><span className="text-slate-500">{c.hospital}</span><span className="text-slate-400">{c.date}</span><span className="text-slate-600">{c.amount}</span>
            <span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: apptTone(c.status) + "15", color: apptTone(c.status) }}>{c.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ FAMILY HEALTH */

function FamilyHealthView({ name }: { name: string }) {
  const members = [
    { name, rel: "Self", tone: "#0078d4", score: 72, age: "—" },
    { name: "Ravi Nair", rel: "Spouse", tone: "#16a34a", score: 88, age: "46" },
    { name: "Ananya Nair", rel: "Daughter", tone: "#D6336C", score: 95, age: "17" },
    { name: "Meena Nair", rel: "Mother", tone: "#8764B8", score: 64, age: "71" },
  ];
  return (
    <div className="space-y-4">
      <PageHead title="Family Health" sub="Manage health records for your family." cta={{ label: "Add Member", icon: UserPlus }} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((m, i) => {
          const tone = m.score >= 80 ? "#16a34a" : m.score >= 65 ? "#CA5010" : "#D13438";
          return (
            <div key={i} className={`${card} p-4 text-center`}>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[16px] font-bold text-white" style={{ background: m.tone }}>{portalInitials(m.name)}</span>
              <div className="mt-2 text-[13.5px] font-bold text-slate-800">{m.name}</div>
              <div className="text-[11px] text-slate-400">{m.rel} · {m.age === "—" ? "You" : `${m.age} yrs`}</div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${tone}15`, color: tone }}><Heart size={11} fill={tone} /> {m.score}/100</div>
              <button type="button" className="mt-3 w-full rounded-xl border border-black/[0.08] py-2 text-[11.5px] font-semibold text-slate-600">View Records</button>
            </div>
          );
        })}
      </div>
      <div className={`${card} flex items-center gap-3 p-4`}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(0,120,212,.1)] text-[#0078d4]"><Users size={18} /></span>
        <div className="flex-1"><div className="text-[12.5px] font-semibold text-slate-700">Shared family access</div><div className="text-[11px] text-slate-400">Members can view shared reports and appointments with your consent.</div></div>
        <button type="button" className="rounded-xl bg-[#0078d4] px-3 py-2 text-[11.5px] font-semibold text-white">Manage Access</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- AI ASSISTANT */

function AIAssistantView({ s, name }: { s?: PortalSummary; name: string }) {
  const answer = (q: string): string => {
    const ql = q.toLowerCase();
    if (ql.includes("lab") || ql.includes("report")) {
      const l = s?.labs[0];
      return l ? `Your most recent lab is ${l.test}: ${l.value} (${l.status}). ${l.status.toLowerCase().includes("normal") ? "That's within range — keep it up!" : "This is outside the usual range; please review it with your doctor."}` : "I don't see any lab results on file yet.";
    }
    if (ql.includes("medic") || ql.includes("medicine")) {
      const meds = s?.medications ?? [];
      return meds.length ? `You have ${meds.length} active medication(s): ${meds.map((m) => m.name).join(", ")}. Take them as prescribed and set reminders.` : "You have no active medications on record.";
    }
    if (ql.includes("appointment") || ql.includes("book")) {
      const a = s?.appointments.upcoming[0];
      return a ? `Your next appointment is with ${a.dr} (${a.spec}) on ${a.date} at ${a.time}. You can reschedule from the Appointments page.` : "You have no upcoming appointments. Head to Appointments to book one.";
    }
    if (ql.includes("follow")) return "Based on your records, a follow-up in 2–4 weeks is recommended. I can help you book it.";
    if (ql.includes("tip") || ql.includes("health")) return "Stay hydrated, aim for 30 minutes of daily activity, eat more fibre, and take medicines on time. Small steps add up!";
    return "I'm your ClinIQ assistant. I can explain your lab reports, medications, appointments and health tips. Try one of the suggestions below.";
  };
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: `Hello ${firstName(name)}! I'm your ClinIQ Health Assistant. Ask me about your labs, medicines or appointments.` },
  ]);
  const [input, setInput] = useState("");
  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }, { role: "ai", text: answer(t) }]);
    setInput("");
  };
  return (
    <div className="mx-auto flex h-[calc(100vh-136px)] max-w-3xl flex-col">
      <PageHead title="AI Health Assistant" sub="Ask about your health records — powered by ClinIQ." />
      <div className={`${card} mt-4 flex min-h-0 flex-1 flex-col`}>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "ai" && <span className="mr-2 grid h-8 w-8 shrink-0 place-items-center self-end rounded-xl text-white" style={{ background: "linear-gradient(150deg,#7c3aed,#4f46e5)" }}><Sparkles size={15} /></span>}
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[12.5px] ${m.role === "user" ? "bg-[#0078d4] text-white" : "bg-slate-100 text-slate-700"}`}>{m.text}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-black/[0.06] p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ASSISTANT_CHIPS.map((c) => (<button key={c} type="button" onClick={() => send(c)} className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#7c3aed]/40">{c}</button>))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="w-full bg-transparent text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Ask about your labs, medicines, appointments..." />
            <button type="submit" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(150deg,#7c3aed,#4f46e5)" }}><Send size={15} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- SETTINGS */

function SettingsView({ s, name, mrn, onLogout }: { s?: PortalSummary; name: string; mrn: string; onLogout: () => void }) {
  return (
    <div className="max-w-3xl space-y-4">
      <PageHead title="Settings" sub="Manage your profile, notifications and security." />
      <div className={`${card} p-4`}>
        <SectionHead title="Profile" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[["Name", name], ["MRN", mrn], ["Mobile", s?.mobile || "—"], ["Gender", s?.gender || "—"], ["Blood Group", s?.bloodGroup || "—"], ["Age", s?.age ? `${s.age} yrs` : "—"]].map(([k, v]) => (
            <div key={k}><div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="text-[12.5px] font-semibold text-slate-700">{v}</div></div>
          ))}
        </div>
        <button type="button" className="mt-3 rounded-xl border border-black/[0.08] px-3 py-2 text-[11.5px] font-semibold text-slate-600">Edit Profile</button>
      </div>
      <div className={`${card} p-4`}>
        <SectionHead title="Notifications" />
        <div className="space-y-2.5">
          {["Appointment reminders", "Lab result alerts", "Medication reminders", "Billing & payment updates"].map((label, i) => (
            <label key={label} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-slate-600"><Bell size={13} className="text-slate-400" /> {label}</span>
              <input type="checkbox" defaultChecked={i < 3} className="h-4 w-4 rounded border-slate-300 accent-[#0078d4]" />
            </label>
          ))}
        </div>
      </div>
      <div className={`${card} p-4`}>
        <SectionHead title="Security" />
        <div className="space-y-2">
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2.5 text-[12px] font-semibold text-slate-600"><Lock size={14} /> Change password</button>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2.5 text-[12px] font-semibold text-slate-600"><Shield size={14} /> Two-factor authentication</button>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2.5 text-[12px] font-semibold text-slate-600"><Globe size={14} /> Language: English (US)</button>
        </div>
      </div>
      <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-xl border border-[#D13438]/30 px-4 py-2.5 text-[12.5px] font-semibold text-[#D13438]"><LogOut size={15} /> Sign out</button>
    </div>
  );
}

/* --------------------------------------------------------------------- HELP */

function HelpView() {
  const faqs = [
    { q: "How do I book an appointment?", a: "Go to Appointments → Book Appointment, choose a specialty and preferred date, then pick an available slot." },
    { q: "How can I view my lab reports?", a: "Open Lab Reports from the sidebar. Each result shows the value, reference range and status." },
    { q: "How do I request a medicine refill?", a: "Open Medications and tap Refill on any active prescription." },
    { q: "How do I pay my bill?", a: "Go to Billing & Payments and tap Pay Now on any outstanding invoice." },
  ];
  return (
    <div className="max-w-3xl space-y-4">
      <PageHead title="Help & Support" sub="Answers to common questions and ways to reach us." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(0,120,212,.1)] text-[#0078d4]"><MessageSquare size={17} /></span><div className="mt-2 text-[12.5px] font-bold text-slate-800">Live Chat</div><div className="text-[10.5px] text-slate-400">Available 24/7</div></div>
        <div className={`${card} p-4`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Phone size={17} /></span><div className="mt-2 text-[12.5px] font-bold text-slate-800">Call Us</div><div className="text-[10.5px] text-slate-400">+91 98765 43210</div></div>
        <div className={`${card} p-4`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(202,80,16,.1)] text-[#CA5010]"><Mail size={17} /></span><div className="mt-2 text-[12.5px] font-bold text-slate-800">Email</div><div className="text-[10.5px] text-slate-400">care@cliniq.health</div></div>
      </div>
      <div className={`${card} p-4`}>
        <SectionHead title="Frequently Asked Questions" />
        <div className="divide-y divide-black/[0.05]">
          {faqs.map((f, i) => (
            <details key={i} className="group py-2.5">
              <summary className="flex cursor-pointer items-center justify-between text-[12.5px] font-semibold text-slate-700">{f.q}<ChevronRight size={14} className="text-slate-400 transition group-open:rotate-90" /></summary>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <div className={`${card} flex items-center gap-3 p-4`} style={{ borderColor: "rgba(209,52,56,.2)" }}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(209,52,56,.1)] text-[#D13438]"><TriangleAlert size={18} /></span>
        <div className="flex-1"><div className="text-[12.5px] font-bold text-slate-800">Medical emergency?</div><div className="text-[11px] text-slate-400">Call the 24×7 emergency helpline immediately.</div></div>
        <a href="tel:108" className="rounded-xl bg-[#D13438] px-3 py-2 text-[12px] font-semibold text-white">Call 108</a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- PLACEHOLDER */

function Placeholder({ label, onHome }: { label: string; onHome: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className={`${card} grid max-w-sm place-items-center gap-3 p-10 text-center`}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)" }}><Sparkles size={24} /></span>
        <div className="text-[16px] font-bold text-slate-800">{label}</div>
        <p className="text-[12.5px] text-slate-500">This section is coming soon. We're building a premium {label.toLowerCase()} experience for you.</p>
        <button type="button" onClick={onHome} className="mt-1 rounded-xl bg-[#0078d4] px-4 py-2 text-[12.5px] font-semibold text-white">Back to Home</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- SHELL */

export default function PatientPortal() {
  const navigate = useNavigate();
  const [active, setActive] = useState("Home");
  const { data: s, isLoading, isError } = usePortalSummary();
  const session = getPortalSession();
  const name = session?.name ?? s?.name ?? "Patient";
  const mrn = session?.mrn ?? s?.mrn ?? "—";

  const logout = () => { clearPortalSession(); navigate("/os/login", { replace: true }); };

  // Guard: validate the token server-side and react to cross-tab logout.
  useEffect(() => {
    if (!getPortalToken()) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cliniq.portal.session" && !e.newValue) navigate("/os/login", { replace: true });
    };
    window.addEventListener("storage", onStorage);
    fetchPortalMe().catch(() => {
      clearPortalSession();
      navigate("/os/login", { replace: true });
    });
    return () => window.removeEventListener("storage", onStorage);
  }, [navigate]);

  if (!session) return <Navigate to="/os/login" replace />;

  const content = (() => {
    if (isLoading && !s) return <div className="grid min-h-[60vh] place-items-center text-slate-400"><Loader2 className="animate-spin" size={28} /></div>;
    switch (active) {
      case "Home": return <HomeView s={s} name={name} go={setActive} />;
      case "Appointments": return <AppointmentsView s={s} />;
      case "Lab Reports": return <LabReportsView s={s} />;
      case "Medications": return <MedicationsView s={s} />;
      case "Radiology": return <RadiologyView s={s} />;
      case "Health Records": return <HealthRecordsView s={s} />;
      case "Billing & Payments": return <BillingView s={s} />;
      case "Insurance": return <InsuranceView s={s} />;
      case "Care Plan": return <CarePlanView s={s} />;
      case "Family Health": return <FamilyHealthView name={name} />;
      case "AI Assistant": return <AIAssistantView s={s} name={name} />;
      case "Settings": return <SettingsView s={s} name={name} mrn={mrn} onLogout={logout} />;
      case "Help & Support": return <HelpView />;
      default: return <Placeholder label={active} onHome={() => setActive("Home")} />;
    }
  })();

  return (
    <div className="flex min-h-screen text-slate-800" style={{ fontFamily: '"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif', background: "#f5f7fb" }}>
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-black/[0.06] bg-white px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)" }}><HeartPulse size={20} /></span>
          <div className="leading-tight"><div className="text-[17px] font-extrabold text-[#0c3b63]">ClinIQ</div><div className="text-[10px] text-slate-400">Patient Portal</div></div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => <NavItem key={n.label} icon={n.icon} label={n.label} active={active === n.label} onClick={() => setActive(n.label)} />)}
          <div className="my-2 h-px bg-black/[0.06]" />
          <NavItem icon={Settings} label="Settings" active={active === "Settings"} onClick={() => setActive("Settings")} />
          <NavItem icon={HelpCircle} label="Help & Support" active={active === "Help & Support"} onClick={() => setActive("Help & Support")} />
          <NavItem icon={LogOut} label="Logout" onClick={logout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white px-5">
          <label className="flex h-10 max-w-[440px] flex-1 items-center gap-2 rounded-xl border border-black/[0.08] bg-slate-50 px-3.5 text-slate-400">
            <Search size={16} /><input className="w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search doctors, records, reports..." />
          </label>
          <div className="ml-auto flex items-center gap-2.5">
            {isError && <span className="rounded-lg bg-[rgba(202,80,16,.1)] px-2 py-1 text-[10.5px] font-semibold text-[#CA5010]">Offline — showing cached view</span>}
            <button type="button" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Bell size={19} /><span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D13438] px-1 text-[8px] font-bold text-white">{s?.problems.length ?? 0}</span></button>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><MessageSquare size={19} /></button>
            <button type="button" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-slate-100">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0c3b63] text-[12px] font-bold text-white">{portalInitials(name)}</span>
              <span className="hidden text-left leading-tight sm:block"><span className="block text-[13px] font-bold text-slate-700">{name}</span><span className="block text-[10px] text-slate-400">MRN: {mrn}</span></span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">{content}</main>
      </div>
    </div>
  );
}
