import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, HeartPulse, Stethoscope, Syringe, FlaskConical, ClipboardList,
  Pill, MonitorDot, ShieldAlert, MessageSquareHeart, ChevronRight,
  Users, Timer, ListChecks,
} from "lucide-react";
import { api } from "../lib/api";
import { Card, Metric } from "../components/ui";

const WORKSPACES = [
  { to: "/patient/checkin", label: "Patient Check-in", icon: MessageSquareHeart, color: "#0078D4", desc: "Start a new visit via WhatsApp-style self check-in." },
  { to: "/triage", label: "Triage Desk", icon: HeartPulse, color: "#D13438", desc: "Nurse-led vitals capture and ESI-based prioritization." },
  { to: "/copilot", label: "Doctor Workspace", icon: Stethoscope, color: "#038387", desc: "Consult queue, AI-assisted notes and prescriptions." },
  { to: "/oncology", label: "Oncology & Cancer Care", icon: Syringe, color: "#8764B8", desc: "Diagnosis staging, chemotherapy and tumor board tracking." },
  { to: "/lab", label: "Lab Workspace", icon: FlaskConical, color: "#107C10", desc: "Order intake, sample collection and result entry." },
  { to: "/reception", label: "Reception Desk", icon: ClipboardList, color: "#4F6BED", desc: "Appointments, registration and front-desk operations." },
  { to: "/pharmacy", label: "Pharmacy Desk", icon: Pill, color: "#CA5010", desc: "Prescription verification and medication dispensing." },
  { to: "/command", label: "Command Center", icon: MonitorDot, color: "#004E8C", desc: "Hospital-wide operational and compliance overview." },
  { to: "/admin", label: "Admin Workspace", icon: ShieldAlert, color: "#5C2E91", desc: "Staff, departments and platform configuration." },
];

export default function Home() {
  const nav = useNavigate();
  const { data: m } = useQuery({ queryKey: ["metrics"], queryFn: api.metrics, refetchInterval: 5000 });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden !p-0">
        <div className="relative px-8 py-10"
          style={{ background: "radial-gradient(760px 320px at 20% -30%, rgba(0,120,212,.18), transparent 62%), radial-gradient(700px 320px at 100% 120%, rgba(0,69,120,.14), transparent 60%)" }}>
          <div className="text-[12px] font-extrabold uppercase tracking-[0.34em]" style={{ color: "var(--cyan)" }}>
            Next-Gen Clinical OS
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn" onClick={() => nav("/patient/checkin")}>
              Start a patient journey <ArrowRight size={16} />
            </button>
            <button className="btn ghost" onClick={() => nav("/command")}>Open Command Center</button>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {["ABDM / ABHA", "FHIR R4", "Clinician-in-the-loop", "DPDP-aligned", "Self-hosted"].map((t) => (
              <span key={t} className="rounded-full px-3 py-1 text-[12px]"
                style={{ background: "var(--panel)", border: "1px solid var(--glass-border)", color: "var(--ink)" }}>{t}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* Live snapshot */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold" style={{ color: "#2b7fd0" }}>Live hospital snapshot</h2>
          <span className="live">LIVE</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric value={m?.headline?.patients_today ?? "—"} label="Patients today" icon={Users} accent="#0078D4" />
          <Metric value={m ? `${m.headline.door_to_doctor_min}m` : "—"} label="Door-to-doctor" icon={Timer} accent="#038387" />
          <Metric value={m?.headline?.in_queue ?? "—"} label="In queue" icon={ListChecks} accent="#CA5010" />
          <Metric value={m?.headline?.compliance_gaps ?? "—"} label="Compliance gaps" icon={ShieldAlert} accent="#D13438" />
        </div>
      </div>

      {/* Workspaces */}
      <div>
        <div className="mb-2">
          <h2 className="text-lg font-extrabold" style={{ color: "#2b7fd0" }}>Explore workspaces</h2>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Jump straight into any role-based workspace across the patient journey.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORKSPACES.map((w) => (
            <button
              key={w.to}
              type="button"
              onClick={() => nav(w.to)}
              className="card relative flex items-start gap-3.5 overflow-hidden text-left transition"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: w.color }} />
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
                style={{ background: w.color, boxShadow: `0 4px 10px ${w.color}30` }}>
                <w.icon size={20} color="#ffffff" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold" style={{ color: "var(--ink)" }}>{w.label}</span>
                  <ChevronRight size={16} style={{ color: "var(--dim)" }} className="shrink-0" />
                </span>
                <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--muted)" }}>{w.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
