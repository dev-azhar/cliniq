/**
 * Data layer for the Smart Hospital OS (`/os`) dashboard.
 *
 * Each hook fetches live values from the FastAPI backend (proxied at `/api`).
 * Views merge these over their static placeholder definitions, so the UI keeps
 * rendering (with placeholders) even while loading or if the backend is offline.
 */
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { osAuthHeader } from "./osSession";

export interface OsOverview {
  status: {
    hospital: string | null;
    occupancy: string | null;
    erWaitMinutes: number | null;
    icuOccupancy: string | null;
    bedsAvailable: number | null;
  };
  kpis: {
    criticalLabs: number | null;
    bedsAvailable: number | null;
    prescriptionsPending: number | null;
    erPatients: number | null;
    dischargesToday: number | null;
    todaysRevenue: string | null;
  };
  patientsToday: number;
  totalPatients: number;
  generatedAt: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json", ...osAuthHeader() } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function useOsOverview() {
  return useQuery({
    queryKey: ["os", "overview"],
    queryFn: () => fetchJson<OsOverview>("/api/v1/os/overview"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export interface OsBilling {
  kpis: {
    totalInvoices: number; claimsSubmitted: number; claimsPaid: number;
    denials: number; paymentPosts: number; refunds: number;
  };
  arAging: { total: string; segments: { label: string; value: string; pct: number }[] };
  claimsSummary: { total: number; approved: number; denied: number; pending: number };
  paymentModes: { total: string; modes: { label: string; value: string; pct: number }[] };
  invoices: { invoice: string; name: string; mrn: string; date: string; visit: string; gross: string; balance: string; status: string }[];
  recentPayments: { receipt: string; name: string; method: string; amount: string; on: string }[];
  generatedAt: string;
}

export function useOsBilling() {
  return useQuery({
    queryKey: ["os", "billing"],
    queryFn: () => fetchJson<OsBilling>("/api/v1/os/billing"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

interface DonutSegment { label: string; value: string; pct: number; color: string }

export interface OsInventory {
  kpis: {
    totalItems: number; stockValue: string; purchaseOrders: number;
    grnPending: number; transfersInTransit: number; suppliers: number;
  };
  stockOverview: { total: string; segments: DonutSegment[] };
  valueByCategory: { total: string; segments: DonutSegment[] };
  tabCounts: { allItems: number; lowStock: number; outOfStock: number; expiringSoon: number; nonMoving: number };
  items: { code: string; name: string; category: string; unit: string; current: string; min: string; max: string; status: string; updated: string }[];
  purchaseOrders: { po: string; supplier: string; date: string; status: string; value: string }[];
  expiring: { name: string; batch: string; exp: string; qty: string }[];
  topConsumed: { name: string; qty: string; unit: string }[];
  stores: { store: string; total: string; inStock: string; low: string; out: string; value: string }[];
  suppliers: { name: string; otd: string; quality: string; fill: string; rating: number }[];
  generatedAt: string;
}

export function useOsInventory() {
  return useQuery({
    queryKey: ["os", "inventory"],
    queryFn: () => fetchJson<OsInventory>("/api/v1/os/inventory"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export interface OsSurgery {
  kpis: { scheduled: number; inPreOp: number; inProgress: number; postOp: number; completed: number; cancelled: number };
  schedule: { time: string; or: string; name: string; mrn: string; proc: string; surgeon: string; srole: string; anes: string; arole: string; status: string; tone: string; dur: string; alert: boolean }[];
  otStatus: { or: string; proc: string; pct: number; status: string; tone: string }[];
  upcoming: { date: string; proc: string; surgeon: string; or: string }[];
  currentSurgery: { name: string; mrn: string; or: string; procedure: string; surgeon: string; anesthesia: string; start: string; end: string; status: string } | null;
  generatedAt: string;
}

export function useOsSurgery() {
  return useQuery({
    queryKey: ["os", "surgery"],
    queryFn: () => fetchJson<OsSurgery>("/api/v1/os/surgery"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export interface OsPatientListItem {
  patientId: string; name: string; mrn: string | null; age: number | null;
  gender: string | null; department: string; status: string | null;
}

export interface OsPatient {
  patientId: string; name: string; mrn: string | null; age: number | null; gender: string | null;
  bloodGroup: string | null; mobile: string | null; summary: string | null;
  riskLevel: string; abnormalLabs: number; department: string; status: string | null;
  admittedOn: string | null; admittedTime: string | null; attendingPhysician: string | null; attendingDept: string | null;
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
  generatedAt: string;
}

export function useOsPatients() {
  return useQuery({
    queryKey: ["os", "patients"],
    queryFn: () => fetchJson<{ patients: OsPatientListItem[]; total: number }>("/api/v1/os/patients"),
    staleTime: 30_000,
  });
}

export function useOsPatient(patientId: string | null) {
  return useQuery({
    queryKey: ["os", "patient", patientId],
    queryFn: () => fetchJson<OsPatient>(`/api/v1/os/patients/${patientId}`),
    enabled: !!patientId,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
