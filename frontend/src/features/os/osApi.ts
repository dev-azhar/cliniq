/**
 * Data layer for the Smart Hospital OS (`/os`) dashboard.
 *
 * Each hook fetches live values from the FastAPI backend (proxied at `/api`).
 * Views merge these over their static placeholder definitions, so the UI keeps
 * rendering (with placeholders) even while loading or if the backend is offline.
 */
import { useQuery } from "@tanstack/react-query";
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
