/**
 * Data layer for the patient portal (`/portal`).
 *
 * `usePortalSummary` fetches the logged-in patient's full dashboard from the
 * FastAPI backend. The portal renders live values over its static demo shell,
 * so it keeps working (with placeholders) while loading or if the API is down.
 */
import { useQuery } from "@tanstack/react-query";
import { portalAuthHeader, getPortalToken, getPortalSession } from "./portalSession";

export interface PortalAppointment {
  dr: string;
  spec: string;
  init: string;
  date: string;
  time: string;
  mode: "In-person" | "Video";
  loc: string;
  status: string;
  upcoming: boolean;
  visitType: string;
}

export interface PortalBillingRow {
  invoice: string;
  date: string;
  gross: string;
  balance: string;
  status: string;
}

export interface PortalSummary {
  patientId: string;
  name: string;
  mrn: string | null;
  age: number | null;
  gender: string | null;
  bloodGroup: string | null;
  mobile: string | null;
  summary: string | null;
  riskLevel: string;
  abnormalLabs: number;
  department: string;
  status: string | null;
  admittedOn: string | null;
  admittedTime: string | null;
  attendingPhysician: string | null;
  attendingDept: string | null;
  vitals: { bp: string | null; hr: number | null; spo2: number | null; temp: number | null; rr: number | null; capturedTs: string | null };
  labs: { test: string; value: string; result: string; unit: string; range: string; flag: string; status: string; date: string }[];
  medications: { name: string; dose: string }[];
  problems: { name: string; onset: string | null }[];
  allergies: { substance: string; severity: string | null }[];
  encounters: { date: string; time: string; type: string; department: string; status: string }[];
  careTeam: { name: string; role: string; badge: string }[];
  vitalsHistory: { date: string; bp: string; hr: number | null; spo2: number | null; temp: number | null; rr: number | null; flag: boolean }[];
  imaging: { name: string; date: string; type: string; uri: string | null }[];
  notes: { kind: string; date: string; author: string; status: string; excerpt: string; icd10: string[] }[];
  documents: { name: string; category: string; date: string; uri: string | null }[];
  timeline: { date: string; time: string; kind: string; detail: string; status: string; tone: string }[];
  appointments: { upcoming: PortalAppointment[]; past: PortalAppointment[] };
  billing: { outstanding: string; outstandingRaw: number; invoices: PortalBillingRow[] };
  generatedAt: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json", ...portalAuthHeader() } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function usePortalSummary() {
  const patientId = getPortalSession()?.patientId ?? null;
  return useQuery({
    queryKey: ["portal", "summary", patientId],
    queryFn: () => fetchJson<PortalSummary>("/api/v1/os/portal/summary"),
    enabled: !!getPortalToken(),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}
