import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, HeartPulse, Stethoscope, ClipboardList, MonitorDot, MessageSquareHeart,
  Smartphone, BellRing, ShieldAlert, FlaskConical, Pill, Menu, PanelLeftClose,
  Syringe, ChevronDown, LogOut, LayoutGrid,
} from "lucide-react";
import { api } from "../lib/api";
import { useJourney } from "../lib/store";
import { useRealtime, useRealtimeConnection, LiveEvent } from "../lib/realtime";
import { getPortalPatient, clearPortalPatient } from "../lib/patientAuth";

const NAV = [
  { to: "/", label: "Home", icon: Activity, color: "#0078D4", end: true },
  { to: "/triage", label: "Triage Desk", icon: HeartPulse, color: "#D13438", roles: ["nurse"] },
  { to: "/copilot", label: "Doctor Workspace", icon: Stethoscope, color: "#038387", roles: ["doctor"] },
  { to: "/oncology", label: "Oncology & Cancer Care", icon: Syringe, color: "#8764B8", roles: ["doctor"] },
  { to: "/lab", label: "Lab Workspace", icon: FlaskConical, color: "#107C10", roles: ["lab"] },
  { to: "/pharmacy", label: "Pharmacy Desk", icon: Pill, color: "#CA5010", roles: ["pharmacist"] },
  { to: "/reception", label: "Reception Desk", icon: ClipboardList, color: "#4F6BED", roles: ["receptionist"] },
  { to: "/command", label: "Command Center", icon: MonitorDot, color: "#004E8C", roles: ["admin"] },
  { to: "/admin", label: "Admin Workspace", icon: ShieldAlert, color: "#5C2E91", roles: ["admin"] },
];

function criticalText(e: LiveEvent): string {
  if (e.topic === "result.abnormal") return `Abnormal result · ${e.payload?.test ?? "lab"}`;
  if (e.topic === "triage.completed") return `Red-flag triage · ${e.payload?.specialty ?? ""}`;
  if (e.topic === "compliance.flagged") return "Compliance gap flagged";
  return e.topic;
}

function CriticalToast() {
  const lastCritical = useRealtime((s) => s.lastCritical);
  const [shown, setShown] = useState<LiveEvent | null>(null);
  useEffect(() => {
    if (!lastCritical) return;
    setShown(lastCritical);
    const t = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [lastCritical?.ts]);
  return (
    <AnimatePresence>
      {shown && (
        <motion.div initial={{ opacity: 0, y: 20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20 }} className="alertbox fixed bottom-6 right-6 z-50 flex items-center gap-2"
          style={{ minWidth: 260 }}>
          <BellRing size={16} /> <b>Live alert:</b> {criticalText(shown)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  useRealtimeConnection();
  const journey = useJourney();
  const loc = useLocation();
  const nav = useNavigate();
  const connected = useRealtime((s) => s.connected);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [patientMenuOpen, setPatientMenuOpen] = useState(() => loc.pathname.startsWith("/patient"));
  const [appsOpen, setAppsOpen] = useState(false);

  const activeRole = journey.activeRole;

  // Sidebar always shows every workspace link, independent of the active role
  // selected via the right-side workspace dropdown.
  const visibleNav = NAV;

  // Sync store activeRole with browser URL path (useful on refresh or direct navigation)
  useEffect(() => {
    const path = loc.pathname;
    if ((path === "/copilot" || path === "/oncology") && activeRole !== "doctor") {
      journey.setRole("doctor");
    } else if (path === "/lab" && activeRole !== "lab") {
      journey.setRole("lab");
    } else if (path === "/triage" && activeRole !== "nurse") {
      journey.setRole("nurse");
    } else if (path === "/reception" && activeRole !== "receptionist") {
      journey.setRole("receptionist");
    } else if (path === "/pharmacy" && activeRole !== "pharmacist") {
      journey.setRole("pharmacist");
    } else if ((path === "/command" || path === "/admin") && activeRole !== "admin") {
      journey.setRole("admin");
    } else if (path.startsWith("/patient") && activeRole !== "patient") {
      journey.setRole("patient");
    }
  }, [loc.pathname, activeRole, journey]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-3 sm:gap-3 sm:px-5 lg:px-6"
        style={{
          borderColor: "var(--line)",
          backgroundImage: "var(--glass-highlight), var(--glass-sheen), linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72))",
          backdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "inset 0 -1px 0 rgba(20,33,61,.06)",
        }}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[var(--muted)] transition hover:border-[var(--line2)] hover:bg-black/5 hover:text-[var(--ink)]"
            style={{ borderColor: "var(--glass-border)" }}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={19} />}
          </button>
          <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => nav("/")} aria-label="Go to home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)", boxShadow: "0 6px 14px rgba(0,120,212,.24)" }}>
              <HeartPulse size={18} color="#ffffff" />
            </span>
            <span className="hidden min-[470px]:block">
              <span className="grad-text block text-[15px] font-extrabold leading-tight">ClinIQ</span>
              <span className="block text-[10px] text-[var(--dim)]">Smart Hospital OS</span>
            </span>
          </button>
          <div className="ml-1 hidden min-w-0 truncate border-l border-[var(--line)] pl-3 text-[11px] uppercase tracking-[0.16em] text-[var(--dim)] xl:block">
            {loc.pathname.startsWith("/patient")
              ? "Patient Dashboard"
              : NAV.find((n) => n.to === loc.pathname)?.label || "Patient Journey Platform"}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setAppsOpen((o) => !o)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[var(--muted)] transition hover:border-[var(--line2)] hover:bg-black/5 hover:text-[var(--ink)]"
            style={{ borderColor: "var(--glass-border)" }}
            aria-label="App launcher"
            aria-expanded={appsOpen}
          >
            <LayoutGrid size={18} />
          </button>
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold sm:text-[11px]"
            style={{ color: connected ? "#15803d" : "#92400e" }}>
            <span className="inline-block h-2 w-2 rounded-full"
              style={{ background: connected ? "var(--mint)" : "var(--amber)", boxShadow: `0 0 8px ${connected ? "var(--mint)" : "var(--amber)"}` }} />
            <span className="hidden sm:inline">{connected ? "CONNECTED" : "CONNECTING"}</span>
          </span>
        </div>
      </header>

      {appsOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setAppsOpen(false)} aria-label="Close app launcher" />
          <div className="fixed right-3 top-[68px] z-50 w-[300px] p-3 sm:right-5 lg:right-6"
            role="menu" aria-label="App launcher"
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,.65)",
              background: "linear-gradient(135deg, rgba(255,255,255,.9), rgba(255,255,255,.78))",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              boxShadow: "0 30px 70px rgba(2,32,71,.28), inset 0 1px 0 rgba(255,255,255,.9)",
            }}>
            <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--dim)" }}>Apps</div>
            <div className="grid grid-cols-3 gap-1.5">
              {NAV.map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => { nav(a.to); setAppsOpen(false); closeSidebarOnMobile(); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition hover:bg-black/[0.04]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: a.color, boxShadow: `0 4px 10px ${a.color}30` }}>
                    <a.icon size={18} color="#ffffff" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {sidebarOpen && <button type="button" className="fixed inset-x-0 bottom-0 top-16 z-10 bg-black/55 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      {/* Sidebar */}
      <aside className={`fixed bottom-0 left-0 top-16 z-20 flex w-[236px] flex-col gap-1 p-4 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          borderRight: "1px solid var(--line)",
          backgroundImage: "var(--glass-highlight), var(--glass-sheen), linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.55))",
          backdropFilter: "blur(28px) saturate(180%)",
        }}>
        {visibleNav.map((n, index) => (
          <div key={n.to}>
            <NavLink to={n.to} end={n.end} onClick={closeSidebarOnMobile}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition"
              style={({ isActive }: any) => ({
                color: isActive ? "#004578" : "var(--muted)",
                background: isActive ? "rgba(0,120,212,.12)" : "transparent",
                border: "1px solid transparent",
                boxShadow: isActive ? "inset 3px 0 0 #0078d4" : "none",
              })}>
              <n.icon size={17} color={n.color} />
              {n.label}
            </NavLink>

            {index === 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setPatientMenuOpen((open) => !open)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold transition"
                  style={{
                    color: loc.pathname.startsWith("/patient") ? "#2b7fd0" : "var(--muted)",
                    background: loc.pathname.startsWith("/patient")
                      ? "rgba(0,120,212,.12)"
                      : "transparent",
                    border: "1px solid transparent",
                    boxShadow: loc.pathname.startsWith("/patient") ? "inset 3px 0 0 #0078d4" : "none",
                  }}
                  aria-expanded={patientMenuOpen}
                >
                  <Smartphone size={17} color="#0078D4" />
                  <span className="flex-1">Patient Portal</span>
                  <ChevronDown size={15} className={`transition-transform ${patientMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {patientMenuOpen && (
                  <div className="ml-5 mt-1 space-y-1 border-l border-[var(--line)] pl-2">
                    <NavLink to="/patient" end onClick={closeSidebarOnMobile}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition"
                      style={({ isActive }) => ({ color: isActive ? "#004578" : "var(--muted)", background: isActive ? "rgba(0,120,212,.1)" : "transparent" })}>
                      <Smartphone size={15} /> Dashboard
                    </NavLink>
                    <NavLink to="/patient/checkin" onClick={closeSidebarOnMobile}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition"
                      style={({ isActive }) => ({ color: isActive ? "#004578" : "var(--muted)", background: isActive ? "rgba(0,120,212,.1)" : "transparent" })}>
                      <MessageSquareHeart size={15} /> Check-in
                    </NavLink>
                    {getPortalPatient() && (
                      <button
                        type="button"
                        onClick={() => {
                          clearPortalPatient();
                          journey.reset();
                          setPatientMenuOpen(false);
                          closeSidebarOnMobile();
                          nav("/patient/login?redirect=/patient", { replace: true });
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <LogOut size={15} /> Log out
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="mt-auto space-y-2">
          {journey.patientName && (
            <div className="card p-3 text-[12px] relative group">
              <div className="mb-1 flex items-center justify-between font-bold" style={{ color: "#2b7fd0" }}>
                <span className="flex items-center gap-1"><ClipboardList size={13} /> Active Session</span>
                <button
                  onClick={() => journey.reset()}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  title="Clear patient session"
                >
                  Reset
                </button>
              </div>
              <div style={{ color: "var(--ink)" }} className="font-semibold">{journey.patientName}</div>
              <div style={{ color: "var(--dim)" }}>{journey.department || "—"}</div>
              {journey.token && <div className="mt-1"><span className="tag violet">Token {journey.token}</span></div>}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`min-w-0 pt-16 transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-[236px]" : "ml-0"}`}>
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }} className="mx-auto w-full min-w-0 max-w-[2560px] px-3 py-4 pb-6 sm:px-5 sm:py-5 lg:px-6 lg:py-6 2xl:px-8">
          {children}
        </motion.main>
      </div>

      <CriticalToast />
    </div>
  );
}
