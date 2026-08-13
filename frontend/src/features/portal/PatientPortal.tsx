import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HeartPulse, Home, Calendar, FileText, FlaskConical, ScanLine, Pill, CreditCard,
  Shield, Users, ClipboardList, Sparkles, Settings, HelpCircle, LogOut, Search,
  Bell, MessageSquare, ChevronDown, Clock, MapPin, CalendarPlus, CheckCircle2, Circle,
  TriangleAlert, Video, RefreshCw, Download, Building2, Mic, Phone, Heart, Navigation,
  Info, ChevronRight,
} from "lucide-react";
import type { ComponentType } from "react";

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

const STATS = [
  { icon: Calendar, tint: "#0078d4", title: "Next Appointment", big: "10:00 AM", sub: "Tomorrow", note: "Dr. Ahmed Ali", cta: "View Details" },
  { icon: Pill, tint: "#16a34a", title: "Active Medications", big: "3", sub: "Medications", cta: "View All" },
  { icon: FileText, tint: "#8764B8", title: "Reports Ready", big: "2", sub: "Reports", cta: "View Reports" },
  { icon: CreditCard, tint: "#CA5010", title: "Outstanding Bill", big: "₹ 2,450", sub: "Due Amount", cta: "Pay Now" },
  { icon: Bell, tint: "#0891b2", title: "Health Reminders", big: "2", sub: "Pending", cta: "View All" },
];

const JOURNEY = [
  { label: "Registration", time: "09:15 AM", state: "done" },
  { label: "Check-In", time: "09:30 AM", state: "done" },
  { label: "Consultation", time: "10:00 AM", state: "current" },
  { label: "Lab Tests", time: "", state: "todo" },
  { label: "Pharmacy", time: "", state: "todo" },
  { label: "Billing", time: "", state: "todo" },
  { label: "Follow-up", time: "", state: "todo" },
];

const LABS = [
  { test: "HbA1c", date: "May 18, 2026", value: "6.2 %", status: "Normal", tone: "#16a34a" },
  { test: "Lipid Profile", date: "May 18, 2026", value: "110 mg/dL", status: "Borderline", tone: "#CA5010" },
  { test: "CBC", date: "May 18, 2026", value: "", status: "Normal", tone: "#16a34a" },
];

const MEDS = [
  { name: "Metformin 500 mg", freq: "1 - 0 - 1", when: "After Meal" },
  { name: "Aspirin 75 mg", freq: "1 - 0 - 0", when: "Morning" },
  { name: "Atorvastatin 20 mg", freq: "0 - 0 - 1", when: "Night" },
];

const ALERTS = [
  { icon: TriangleAlert, tone: "#D13438", title: "Follow-up Due", body: "Cardiology follow-up in 7 days", date: "May 25, 2026" },
  { icon: TriangleAlert, tone: "#CA5010", title: "BP Monitoring", body: "Please monitor your BP regularly", date: "May 18, 2026" },
  { icon: Info, tone: "#0078d4", title: "Vaccine Due", body: "Flu vaccine is due", date: "May 30, 2026" },
];

const QUICK = [
  { icon: Calendar, label: "Book Appointment" },
  { icon: Video, label: "Teleconsult" },
  { icon: RefreshCw, label: "Refill Medicine" },
  { icon: CreditCard, label: "Pay Bill" },
  { icon: Download, label: "Download Reports" },
  { icon: Building2, label: "Find Hospital" },
];

const TASKS = [
  { label: "Take Metformin 500 mg", meta: "8:00 AM", done: false },
  { label: "Health Assessment", meta: "Due on May 25, 2026", done: false },
  { label: "Pay outstanding bill", meta: "₹ 2,450", done: false },
];

const FAMILY = [
  { name: "Ahmed Ahmed", rel: "Self", tone: "#0078d4" },
  { name: "Fatima Ahmed", rel: "Daughter", tone: "#D6336C" },
  { name: "Omar Ahmed", rel: "Son", tone: "#16a34a" },
  { name: "Aisha Ahmed", rel: "Mother", tone: "#8764B8" },
];

const ASSISTANT_CHIPS = [
  "Explain my latest lab report",
  "Book an appointment",
  "What medicines should I take?",
  "Do I need a follow-up?",
  "Any health tips for me?",
];

function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase();
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: ComponentType<{ size?: number | string }>; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition"
      style={{ color: active ? "#0a5aa8" : "#475569", background: active ? "rgba(0,120,212,.09)" : "transparent" }}>
      <Icon size={17} /> <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function StatCard({ s }: { s: typeof STATS[number] }) {
  return (
    <div className={`${card} p-3.5`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${s.tint}15`, color: s.tint }}><s.icon size={17} /></span>
        <span className="text-[10.5px] font-semibold text-slate-400">{s.title}</span>
      </div>
      <div className="text-[19px] font-extrabold leading-none text-slate-800">{s.big}</div>
      <div className="mt-0.5 text-[10.5px] text-slate-400">{s.note ?? s.sub}</div>
      <button type="button" className="mt-2 flex items-center gap-0.5 text-[11px] font-semibold text-[#0078d4]">{s.cta} <ChevronRight size={12} /></button>
    </div>
  );
}

export default function PatientPortal() {
  const navigate = useNavigate();
  const [active, setActive] = useState("Home");
  return (
    <div className="flex min-h-screen text-slate-800" style={{ fontFamily: '"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif', background: "#f5f7fb" }}>
      {/* ---------------------------------------------------------- SIDEBAR */}
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-black/[0.06] bg-white px-3 py-4 lg:flex">
        <div className="mb-4 flex items-center gap-2.5 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)" }}><HeartPulse size={20} /></span>
          <div className="leading-tight"><div className="text-[17px] font-extrabold text-[#0c3b63]">ClinIQ</div><div className="text-[10px] text-slate-400">Smart Hospital OS</div></div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => <NavItem key={n.label} icon={n.icon} label={n.label} active={active === n.label} onClick={() => setActive(n.label)} />)}
          <div className="my-2 h-px bg-black/[0.06]" />
          <NavItem icon={Settings} label="Settings" onClick={() => setActive("Settings")} />
          <NavItem icon={HelpCircle} label="Help & Support" onClick={() => setActive("Help & Support")} />
          <NavItem icon={LogOut} label="Logout" onClick={() => navigate("/os/login")} />
        </div>
        <div className="mt-3 rounded-2xl bg-[linear-gradient(160deg,#eaf2fb,#f4f8fd)] p-3">
          <div className="text-[12px] font-bold text-[#0c3b63]">Book appointments on the go!</div>
          <div className="mt-0.5 text-[10px] text-slate-500">Download the ClinIQ App</div>
          <div className="mt-2 flex gap-1.5">
            <span className="rounded-md bg-black px-2 py-1 text-[8px] font-semibold text-white">App Store</span>
            <span className="rounded-md bg-black px-2 py-1 text-[8px] font-semibold text-white">Google Play</span>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white px-5">
          <label className="flex h-10 max-w-[440px] flex-1 items-center gap-2 rounded-xl border border-black/[0.08] bg-slate-50 px-3.5 text-slate-400">
            <Search size={16} /><input className="w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search doctors, hospitals, specialties..." />
          </label>
          <div className="ml-auto flex items-center gap-2.5">
            <button type="button" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Bell size={19} /><span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D13438] px-1 text-[8px] font-bold text-white">3</span></button>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><MessageSquare size={19} /></button>
            <button type="button" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-slate-100">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0c3b63] text-[12px] font-bold text-white">SA</span>
              <span className="hidden text-left leading-tight sm:block"><span className="block text-[13px] font-bold text-slate-700">Sarah Ahmed</span><span className="block text-[10px] text-slate-400">MRN: CLN-00012345</span></span>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
          </div>
        </header>

        {/* content */}
        <main className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            {/* -------------------------------------------------- LEFT MAIN */}
            <div className="min-w-0 space-y-4">
              {/* greeting + health score banner */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-[22px] font-extrabold tracking-tight text-slate-800">Good Morning, Sarah! 👋</h1>
                  <p className="text-[13px] text-slate-500">Here's your health summary for today.</p>
                </div>
                <div className={`${card} flex items-center gap-3 p-3`}>
                  <div className="flex items-center gap-2">
                    <Heart size={18} className="text-[#16a34a]" fill="#16a34a" />
                    <div><div className="text-[10px] font-semibold text-slate-400">AI Health Score</div><div className="text-[20px] font-extrabold leading-none text-slate-800">89 <span className="text-[11px] font-medium text-slate-400">/100</span></div></div>
                  </div>
                  <div className="h-8 w-px bg-black/[0.06]" />
                  <div><div className="text-[12px] font-bold text-[#16a34a]">Great Job! 🎉</div><div className="text-[10.5px] text-slate-400">You are doing well.</div><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Details ›</button></div>
                </div>
              </div>

              {/* stat tiles */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {STATS.map((s) => <StatCard key={s.title} s={s} />)}
              </div>

              {/* upcoming appointment + journey */}
              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div className={`${card} p-4`}>
                  <h3 className="mb-3 text-[13.5px] font-bold text-slate-800">Upcoming Appointment</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0c3b63] text-[16px] font-bold text-white">AA</span>
                      <div>
                        <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-800">Dr. Ahmed Ali <CheckCircle2 size={14} className="text-[#0078d4]" /></div>
                        <div className="text-[12px] text-slate-500">Cardiologist</div>
                        <div className="text-[10.5px] text-slate-400">MBBS, MD, DM Cardiology</div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#CA8A04]">★ 4.8 <span className="font-normal text-slate-400">(512 reviews)</span></div>
                        <div className="mt-1.5 flex gap-1.5">
                          <span className="rounded-md bg-[rgba(0,120,212,.1)] px-2 py-0.5 text-[10px] font-semibold text-[#0a5aa8]">OPD Visit</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Follow-up</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 text-[12px] text-slate-600">
                      <div className="flex items-center gap-2"><Calendar size={13} className="text-slate-400" /> May 21, 2026 (Tomorrow)</div>
                      <div className="flex items-center gap-2"><Clock size={13} className="text-slate-400" /> 10:00 AM</div>
                      <div className="flex items-center gap-2"><MapPin size={13} className="text-slate-400" /> OPD Room 203, Main Building</div>
                      <div className="flex items-center gap-2"><Users size={13} className="text-slate-400" /> Your position in queue: #6</div>
                      <div className="flex items-center gap-2 text-[#0078d4]"><Clock size={13} /> Estimated wait time: 15 mins</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0078d4] py-2.5 text-[12px] font-semibold text-white"><CheckCircle2 size={14} /> Check-In</button>
                    <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><Calendar size={14} /> Reschedule</button>
                    <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><Navigation size={14} /> Directions</button>
                    <button type="button" className="flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] py-2.5 text-[12px] font-semibold text-slate-600"><CalendarPlus size={14} /> Add to Calendar</button>
                  </div>
                </div>

                <div className={`${card} p-4`}>
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-[13.5px] font-bold text-slate-800">My Health Journey</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <div className="space-y-0">
                    {JOURNEY.map((j, i) => (
                      <div key={j.label} className="flex gap-2.5">
                        <div className="flex flex-col items-center">
                          {j.state === "done" ? <CheckCircle2 size={18} className="text-[#16a34a]" /> : j.state === "current" ? <span className="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-[#0078d4]"><span className="h-1.5 w-1.5 rounded-full bg-[#0078d4]" /></span> : <Circle size={18} className="text-slate-300" />}
                          {i < JOURNEY.length - 1 && <span className="my-0.5 h-5 w-px" style={{ background: j.state === "done" ? "#16a34a" : "#e2e8f0" }} />}
                        </div>
                        <div className="-mt-0.5 flex flex-1 items-center justify-between pb-1">
                          <span className="text-[12.5px] font-semibold" style={{ color: j.state === "todo" ? "#94a3b8" : "#334155" }}>{j.label}</span>
                          {j.time && <span className="text-[10.5px] text-slate-400">{j.time}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">See full journey ›</button>
                </div>
              </div>

              {/* labs / meds / alerts */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className={`${card} p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Recent Lab Results</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <div className="space-y-2">
                    {LABS.map((l) => (
                      <div key={l.test} className="flex items-center justify-between gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                        <div><div className="text-[12.5px] font-semibold text-slate-700">{l.test}</div><div className="text-[10px] text-slate-400">{l.date}</div></div>
                        <div className="flex items-center gap-2">{l.value && <span className="text-[11.5px] font-semibold text-slate-600">{l.value}</span>}<span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${l.tone}15`, color: l.tone }}>{l.status}</span></div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">View All Reports ›</button>
                </div>

                <div className={`${card} p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Active Medications</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <div className="space-y-2">
                    {MEDS.map((m) => (
                      <div key={m.name} className="flex items-center justify-between gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Pill size={13} /></span><span className="text-[12.5px] font-semibold text-slate-700">{m.name}</span></div>
                        <div className="text-right"><div className="text-[11px] font-bold text-slate-600" style={{ fontVariantNumeric: "tabular-nums" }}>{m.freq}</div><div className="text-[10px] text-slate-400">{m.when}</div></div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">Refill Medicines ›</button>
                </div>

                <div className={`${card} p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Health Alerts</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <div className="space-y-2">
                    {ALERTS.map((a) => (
                      <div key={a.title} className="flex items-start gap-2 border-b border-black/[0.04] pb-2 last:border-0">
                        <a.icon size={15} className="mt-0.5 shrink-0" style={{ color: a.tone }} />
                        <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-slate-700">{a.title}</div><div className="text-[10.5px] text-slate-500">{a.body}</div></div>
                        <span className="shrink-0 text-[9.5px] text-slate-400">{a.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* insurance / tasks / tips */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className={`${card} p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Insurance Summary</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View Details ›</button></div>
                  <div className="grid grid-cols-2 gap-y-2.5">
                    {[["Policy Number", "HDFX-987654321"], ["Coverage Left", "₹ 3.20 L"], ["Valid Till", "Dec 31, 2026"], ["Claim Status", "Approved"]].map(([k, v]) => (
                      <div key={k}><div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="text-[12px] font-semibold" style={{ color: v === "Approved" ? "#16a34a" : "#334155" }}>{v}</div></div>
                    ))}
                  </div>
                </div>

                <div className={`${card} p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Upcoming Tasks</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <div className="space-y-2">
                    {TASKS.map((t) => (
                      <label key={t.label} className="flex items-center gap-2.5">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-[#0078d4]" />
                        <span className="flex-1 text-[12px] text-slate-600">{t.label}</span>
                        <span className="text-[10.5px] font-semibold text-slate-400">{t.meta}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={`${card} overflow-hidden p-4`}>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Health Tips for You</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                  <p className="text-[12px] leading-relaxed text-slate-600">Walk for 30 minutes daily to keep your heart healthy. Drink at least 8 glasses of water every day.</p>
                  <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">More Tips ›</button>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------- RIGHT RAIL */}
            <div className="space-y-4">
              {/* AI Health Assistant */}
              <div className={`${card} flex flex-col p-4`}>
                <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#7c3aed,#4f46e5)" }}><Sparkles size={16} /></span><div><div className="text-[13px] font-bold text-slate-800">AI Health Assistant</div><span className="rounded bg-[rgba(124,58,237,.12)] px-1.5 py-0.5 text-[9px] font-bold text-[#7c3aed]">BETA</span></div></div>
                <div className="mb-3 rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600"><b className="text-slate-700">Hello Sarah! 👋</b><br />I can help you with</div>
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

              {/* Quick Actions */}
              <div className={`${card} p-4`}>
                <h3 className="mb-3 text-[13px] font-bold text-slate-800">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK.map((q) => (
                    <button key={q.label} type="button" className="flex flex-col items-center gap-1.5 rounded-xl border border-black/[0.06] bg-slate-50/60 px-1 py-3 text-center hover:border-[#0078d4]/30">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><q.icon size={16} /></span>
                      <span className="text-[9.5px] font-semibold leading-tight text-slate-600">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Family Members */}
              <div className={`${card} p-4`}>
                <div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-800">Family Members</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All ›</button></div>
                <div className="space-y-2.5">
                  {FAMILY.map((f) => (
                    <div key={f.name} className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: f.tone }}>{initials(f.name)}</span>
                      <span className="flex-1 text-[12.5px] font-semibold text-slate-700">{f.name}</span>
                      <span className="text-[10.5px] text-slate-400">{f.rel}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* support */}
              <div className={`${card} p-4`}>
                <h3 className="mb-2 text-[13px] font-bold text-slate-800">Need Help?</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><MessageSquare size={15} /></span><div><div className="text-[12px] font-semibold text-slate-700">Chat with Support</div><div className="text-[10px] text-slate-400">Available 24/7</div></div></div>
                  <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(22,163,74,.1)] text-[#16a34a]"><Phone size={15} /></span><div><div className="text-[12px] font-semibold text-slate-700">Call Us</div><div className="text-[10px] text-slate-400">+91 98765 43210</div></div></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
