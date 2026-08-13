/**
 * Data layer for the Smart Hospital OS (`/os`) dashboard.
 *
 * Each hook fetches live values from the FastAPI backend (proxied at `/api`).
 * Views merge these over their static placeholder definitions, so the UI keeps
 * rendering (with placeholders) even while loading or if the backend is offline.
 */
import { useQuery } from "@tanstack/react-query";

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
  const res = await fetch(path, { headers: { Accept: "application/json" } });
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
