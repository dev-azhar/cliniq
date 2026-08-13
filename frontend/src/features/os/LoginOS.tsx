import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HeartPulse, ShieldCheck, Network, Users, PieChart, User, Lock, Eye, EyeOff,
  KeyRound, Globe, ChevronDown, Stethoscope, MoreHorizontal, Loader2, AlertCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { osLoginRequest, setOsSession } from "./osSession";

const ROLES: { label: string; icon: ComponentType<{ size?: number | string }> }[] = [
  { label: "Doctor", icon: Stethoscope },
  { label: "Nurse", icon: User },
  { label: "Admin", icon: ShieldCheck },
  { label: "Other", icon: MoreHorizontal },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Secure", body: "Enterprise-grade security & privacy" },
  { icon: Network, title: "Connected", body: "Unified data across departments" },
  { icon: Users, title: "Collaborative", body: "Empower your care teams" },
  { icon: PieChart, title: "Insightful", body: "Real-time insights for better decisions" },
];

function HospitalArt() {
  const cols3 = [196, 240, 284];
  return (
    <svg viewBox="0 0 520 260" fill="none" className="mx-auto w-full max-w-[520px]">
      {/* clouds */}
      <g stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round">
        <path d="M64 66 q10 -20 30 -11 q9 -15 27 -4 q17 -1 14 14" />
        <path d="M398 48 q9 -16 27 -8 q10 -12 26 -2" />
      </g>
      {/* trees */}
      <g stroke="#cbd5e1" strokeWidth="2" fill="#eef2f7">
        <circle cx="44" cy="182" r="17" />
        <line x1="44" y1="199" x2="44" y2="214" />
        <circle cx="478" cy="186" r="15" />
        <line x1="478" y1="201" x2="478" y2="214" />
      </g>
      {/* buildings */}
      <rect x="64" y="132" width="96" height="82" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="2" rx="3" />
      <rect x="350" y="118" width="96" height="96" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="2" rx="3" />
      <rect x="180" y="90" width="150" height="124" fill="#f2f6fb" stroke="#cbd5e1" strokeWidth="2" rx="3" />
      {/* cross sign */}
      <rect x="238" y="60" width="34" height="26" rx="4" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M255 66 v14 M248 73 h14" stroke="#0078d4" strokeWidth="3.2" strokeLinecap="round" />
      {/* windows */}
      <g fill="#fff" stroke="#cbd5e1" strokeWidth="1.5">
        {[0, 1].map((r) => cols3.map((x, c) => <rect key={`m${r}${c}`} x={x} y={104 + r * 30} width="28" height="18" rx="2" />))}
        {[0, 1].map((r) => [78, 122].map((x, c) => <rect key={`l${r}${c}`} x={x} y={146 + r * 30} width="26" height="18" rx="2" />))}
        {[0, 1].map((r) => [364, 408].map((x, c) => <rect key={`ri${r}${c}`} x={x} y={132 + r * 32} width="26" height="18" rx="2" />))}
      </g>
      {/* entrance */}
      <rect x="238" y="168" width="34" height="46" rx="2" fill="#fff" stroke="#cbd5e1" strokeWidth="2" />
      <line x1="255" y1="168" x2="255" y2="214" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* ground */}
      <line x1="18" y1="214" x2="502" y2="214" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginOS() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Doctor");
  const [showPw, setShowPw] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (creds: { username: string; password: string; role: string }) => {
    setError(null);
    setLoading(true);
    try {
      const session = await osLoginRequest(creds);
      setOsSession(session);
      navigate("/os");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both your username and password.");
      return;
    }
    void signIn({ username: username.trim(), password, role });
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-4 text-slate-800 sm:p-6"
      style={{
        fontFamily: '"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif',
        background:
          "radial-gradient(1100px 760px at 4% -10%, rgba(23,58,110,.07), transparent 60%)," +
          "radial-gradient(1000px 720px at 99% 0%, rgba(184,148,95,.06), transparent 60%)," +
          "linear-gradient(180deg,#f4f6fa,#fbfcfe)",
      }}
    >
      <div className="flex w-full max-w-[1140px] flex-col overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_30px_80px_rgba(28,33,51,.12)]">
        <div className="grid lg:grid-cols-2">
          {/* ------------------------------------------------- brand panel */}
          <div className="hidden flex-col border-r border-black/[0.06] bg-[linear-gradient(180deg,#f7f9fc,#eef2f8)] p-9 lg:flex xl:p-11">
            <div className="flex items-center gap-2.5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)", boxShadow: "0 8px 18px rgba(0,120,212,.28)" }}>
                <HeartPulse size={22} />
              </span>
              <div className="leading-tight">
                <div className="text-[22px] font-extrabold tracking-tight text-[#0c3b63]">ClinIQ</div>
                <div className="text-[12px] text-slate-400">Smart Hospital OS</div>
              </div>
            </div>

            <div className="mt-10">
              <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight text-[#0c3b63]">
                Intelligent Care.<br />Better Outcomes.
              </h1>
              <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-slate-500">
                ClinIQ connects your teams, patients and data in one unified hospital platform.
              </p>
            </div>

            <div className="my-8"><HospitalArt /></div>

            <div className="grid grid-cols-4 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="text-center">
                  <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl border border-black/[0.06] bg-white text-[#0078d4] shadow-[0_6px_16px_rgba(28,33,51,.06)]"><f.icon size={20} /></span>
                  <div className="text-[12.5px] font-bold text-slate-700">{f.title}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{f.body}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto flex items-center gap-4 pt-9 text-[11px] text-slate-400">
              <span>© 2024 ClinIQ Technologies Pvt. Ltd. All rights reserved.</span>
              <button type="button" className="hover:text-slate-600">Privacy Policy</button>
              <button type="button" className="hover:text-slate-600">Terms of Use</button>
            </div>
          </div>

          {/* -------------------------------------------------- form panel */}
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14">
            <div className="mx-auto w-full max-w-[400px]">
              {/* mobile logo */}
              <div className="mb-8 flex items-center gap-2.5 lg:hidden">
                <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)" }}><HeartPulse size={20} /></span>
                <div className="leading-tight"><div className="text-[18px] font-extrabold text-[#0c3b63]">ClinIQ</div><div className="text-[10.5px] text-slate-400">Smart Hospital OS</div></div>
              </div>

              <h2 className="text-[27px] font-extrabold tracking-tight text-[#0c3b63]">Welcome back</h2>
              <p className="mt-1 text-[13.5px] text-slate-500">Sign in to access your account</p>

              {/* role selector */}
              <div className="mt-6 grid grid-cols-4 gap-1 rounded-xl border border-black/[0.08] bg-slate-50/80 p-1">
                {ROLES.map((r) => {
                  const active = r.label === role;
                  return (
                    <button
                      key={r.label} type="button" onClick={() => setRole(r.label)}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition"
                      style={{
                        background: active ? "#fff" : "transparent",
                        color: active ? "#0a5aa8" : "#64748b",
                        boxShadow: active ? "0 2px 8px rgba(28,33,51,.08)" : "none",
                        border: active ? "1px solid rgba(0,120,212,.22)" : "1px solid transparent",
                      }}
                    >
                      <r.icon size={14} /> {r.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-[#f0b7b9] bg-[#fdf1f1] px-3 py-2.5 text-[12.5px] font-medium text-[#b42026]">
                    <AlertCircle size={15} className="mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Email / Username</label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-black/[0.1] bg-white px-3 text-slate-400 transition focus-within:border-[#0078d4] focus-within:ring-2 focus-within:ring-[rgba(0,120,212,.14)]">
                    <User size={16} />
                    <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" autoComplete="username" placeholder="Enter your email or username" className="w-full bg-transparent text-[13.5px] text-slate-700 outline-none placeholder:text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Password</label>
                  <div className="flex h-11 items-center gap-2.5 rounded-xl border border-black/[0.1] bg-white px-3 text-slate-400 transition focus-within:border-[#0078d4] focus-within:ring-2 focus-within:ring-[rgba(0,120,212,.14)]">
                    <Lock size={16} />
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="w-full bg-transparent text-[13.5px] text-slate-700 outline-none placeholder:text-slate-400" />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label={showPw ? "Hide password" : "Show password"}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                    Remember me
                  </label>
                  <button type="button" className="text-[12.5px] font-semibold text-[#0a5aa8] hover:underline">Forgot password?</button>
                </div>

                <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0078d4] text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(0,120,212,.28)] transition hover:bg-[#106ebe] disabled:cursor-not-allowed disabled:opacity-70">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign In"}
                </button>

                <p className="text-center text-[11.5px] text-slate-400">
                  Demo: any staff name (e.g. <span className="font-semibold text-slate-500">Dr. Ahmed Ali</span>) with password <span className="font-semibold text-slate-500">cliniq</span>
                </p>
              </form>

              <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                <span className="h-px flex-1 bg-black/[0.08]" /> or <span className="h-px flex-1 bg-black/[0.08]" />
              </div>

              <button type="button" disabled={loading} onClick={() => void signIn({ username: "Dr. Ahmed Ali", password: "cliniq", role: "Doctor" })} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/[0.1] bg-white text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70">
                <KeyRound size={16} className="text-slate-500" /> Sign in with SSO (demo)
              </button>

              <p className="mt-6 text-center text-[12.5px] text-slate-500">
                Don't have an account? <button type="button" className="font-semibold text-[#0a5aa8] hover:underline">Contact IT Admin</button>
              </p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- footer bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] bg-white/60 px-8 py-4 text-[11.5px] text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#16a34a]" /> HIPAA Compliant</span>
          <span>Need help? <button type="button" className="font-semibold text-[#0a5aa8] hover:underline">Contact Support</button></span>
          <button type="button" className="flex items-center gap-1.5 hover:text-slate-600"><Globe size={14} /> English (US) <ChevronDown size={13} /></button>
        </div>
      </div>
    </div>
  );
}
