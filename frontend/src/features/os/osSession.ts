/**
 * Session layer for the Smart Hospital OS (`/os`) console.
 *
 * A successful `/api/v1/os/login` returns a staff profile which is persisted to
 * localStorage. The dashboard reads it to personalise the top bar and to guard
 * the route; logout clears it.
 */

export interface OsSession {
  staffId: string | null;
  name: string;
  role: string;
  roleLabel: string;
  department: string;
  specialty: string | null;
  authenticatedAt: string;
}

const STORAGE_KEY = "cliniq.os.session";

export function getOsSession(): OsSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OsSession) : null;
  } catch {
    return null;
  }
}

export function setOsSession(session: OsSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearOsSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Two-letter avatar initials from a staff name (e.g. "Dr. Ahmed Ali" → "AA"). */
export function osInitials(name: string): string {
  const words = name.replace(/^dr\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "US";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export async function osLoginRequest(input: {
  username: string;
  password: string;
  role: string;
}): Promise<OsSession> {
  const res = await fetch("/api/v1/os/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "Sign-in failed. Please try again.";
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as OsSession;
}
