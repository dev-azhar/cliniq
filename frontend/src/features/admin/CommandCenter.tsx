import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, PackageX, Radio, ScrollText, Users, Timer, ListChecks, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/realtime";
import { Card, Metric, Tag, Empty } from "../../components/ui";

const alertTone: Record<string, string> = { SLA: "red", STOCK: "amber", FLOW: "blue", COMPLIANCE: "violet" };

function fmtTopic(t: string) {
  return t.replace(/\./g, " · ").replace(/_/g, " ");
}

export default function Command() {
  const { data: m } = useQuery({ queryKey: ["metrics"], queryFn: api.metrics, refetchInterval: 4000 });
  const events = useRealtime((s) => s.events);
  const { data: au } = useQuery({ queryKey: ["audit"], queryFn: () => api.audit(20), refetchInterval: 6000 });

  const maxQ = Math.max(1, ...Object.values(m?.queue_by_department || { x: 1 }).map((n: any) => Number(n)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="grad-text-page text-2xl font-extrabold">Command Center</h1>
          <p className="text-[13px]" style={{ color: "var(--dim)" }}>
            Real-time operations · Data source: {m?.ai_source || "…"}
          </p>
        </div>
        <span className="live">LIVE</span>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric value={m?.headline?.patients_today ?? "—"} label="Patients today" icon={Users} accent="#0078D4" />
        <Metric value={m ? `${m.headline.door_to_doctor_min}m` : "—"} label="Door-to-doctor" icon={Timer} accent="#038387" />
        <Metric value={m?.headline?.in_queue ?? "—"} label="In queue" icon={ListChecks} accent="#CA5010" />
        <Metric value={m?.headline?.compliance_gaps ?? "—"} label="Compliance gaps" icon={ShieldAlert} accent="#D13438" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Queue by department */}
        <Card>
          <h4 className="mb-3 flex items-center gap-2.5 font-bold" style={{ color: "var(--ink)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "#0078D41f", color: "#0078D4" }}><Activity size={17} /></span>
            Queue load by department
          </h4>
          {m && Object.keys(m.queue_by_department).length ? (
            Object.entries(m.queue_by_department).map(([dept, n]: any) => (
              <div key={dept} className="mb-2">
                <div className="kv !border-0 !py-0.5"><span>{dept}</span><b>{n}</b></div>
                <div className="bar-tk"><i style={{ width: `${(Number(n) / maxQ) * 100}%` }} /></div>
              </div>
            ))
          ) : <Empty>Queue clear</Empty>}
        </Card>

        {/* Live alerts */}
        <Card>
          <h4 className="mb-3 flex items-center gap-2.5 font-bold" style={{ color: "var(--ink)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "#D134381f", color: "#D13438" }}><AlertTriangle size={17} /></span>
            Live alerts <span className="ai-badge">✦ Live</span>
          </h4>
          {m?.alerts?.length ? m.alerts.map((a: any, i: number) => (
            <div key={i} className="kv"><Tag tone={alertTone[a.level] || "blue"}>{a.level}</Tag><span className="flex-1 px-2 text-[12.5px]" style={{ color: "var(--muted)" }}>{a.message}</span></div>
          )) : <Empty>No anomalies detected</Empty>}
          <div className="mt-3">
            <h5 className="mb-1 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "#004578" }}><PackageX size={13} /> Low stock</h5>
            {m && Object.keys(m.low_stock).length ? Object.entries(m.low_stock).map(([d, q]: any) => (
              <div key={d} className="kv !py-0.5"><span>{d}</span><Tag tone="amber">{q} left</Tag></div>
            )) : <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>All items stocked</div>}
          </div>
        </Card>

        {/* Event stream */}
        <Card>
          <h4 className="mb-3 flex items-center gap-2.5 font-bold" style={{ color: "var(--ink)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "#0383871f", color: "#038387" }}><Radio size={17} /></span>
            Domain event stream
          </h4>
          <div className="max-h-[320px] space-y-1 overflow-auto">
            {events.length ? events.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px]">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--cyan)", boxShadow: "0 0 8px var(--cyan)" }} />
                <span style={{ color: "var(--ink)" }}>{fmtTopic(e.topic)}</span>
                <span className="ml-auto" style={{ color: "var(--dim)" }}>{new Date(e.ts).toLocaleTimeString()}</span>
              </div>
            )) : <Empty>Waiting for events…</Empty>}
          </div>
        </Card>

        {/* Audit */}
        <Card>
          <h4 className="mb-3 flex items-center gap-2.5 font-bold" style={{ color: "var(--ink)" }}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: "#5C2E911f", color: "#5C2E91" }}><ScrollText size={17} /></span>
            Audit trail (immutable)
          </h4>
          <div className="max-h-[320px] space-y-1 overflow-auto">
            {au?.audit?.length ? au.audit.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px]">
                <Tag tone="blue">{a.actor_role}</Tag>
                <span style={{ color: "var(--ink)" }}>{a.action}</span>
                {a.consent_id && <span title="consent-linked" style={{ color: "var(--mint)" }}>🔐</span>}
                <span className="ml-auto" style={{ color: "var(--dim)" }}>{new Date(a.ts).toLocaleTimeString()}</span>
              </div>
            )) : <Empty>No audit entries</Empty>}
          </div>
        </Card>
      </div>
    </div>
  );
}
