import { ReactNode, CSSProperties, ComponentType } from "react";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function SectionTitle({ children, sub, plain = false }: { children: ReactNode; sub?: string; plain?: boolean }) {
  return (
    <div className="mb-3">
      <h2 className={`${plain ? "grad-text-page" : "grad-text"} text-xl font-extrabold`}>{children}</h2>
      {sub && <p className="text-[13px]" style={{ color: "var(--dim)" }}>{sub}</p>}
    </div>
  );
}

export function Tag({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function AgentBadge({ label = "Info" }: { label?: string }) {
  return <span className="ai-badge">✦ {label}</span>;
}

export function Ring({ percent, label, sub }: { percent: number; label: string; sub?: string }) {
  return (
    <div className="ring" style={{ ["--p" as any]: `${percent}%` }}>
      <i>
        {label}
        {sub && <small>{sub}</small>}
      </i>
    </div>
  );
}

export function Wave({ recording = true }: { recording?: boolean }) {
  const bars = [8, 16, 22, 12, 19, 9, 15, 20, 11];
  return (
    <span className="wave">
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            height: recording ? undefined : `${h}px`,
            animationDelay: `${i * 0.08}s`,
            animationPlayState: recording ? "running" : "paused",
          }}
        />
      ))}
    </span>
  );
}

export function LiveDot({ label = "LIVE", tone = "red" }: { label?: string; tone?: "red" | "mint" }) {
  return <span className={`live ${tone === "mint" ? "mint" : ""}`}>{label}</span>;
}

export function DeviceBar({ url, right }: { url?: string; right?: ReactNode }) {
  return (
    <div className="bar">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} />
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} />
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} />
      {url && (
        <span className="ml-1.5 flex-1 truncate rounded-md px-2.5 py-1 text-[11px]"
          style={{ background: "rgba(20,33,61,.06)", border: "1px solid var(--line)", color: "var(--dim)" }}>
          {url}
        </span>
      )}
      {right}
    </div>
  );
}

export function Metric({ value, label, icon: Icon, accent }: { value: ReactNode; label: string; icon?: ComponentType<{ size?: number | string }>; accent?: string }) {
  return (
    <div className="metric">
      {accent && <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
      {Icon && accent && (
        <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
          <Icon size={18} />
        </span>
      )}
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px]" style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-dashed p-6 text-center text-[13px]"
      style={{ borderColor: "var(--line2)", color: "var(--dim)" }}
    >
      {children}
    </div>
  );
}