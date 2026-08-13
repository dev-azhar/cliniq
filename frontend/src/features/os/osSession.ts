/**
 * Session layer for the Smart Hospital OS (`/os`) console.
 *
 * `/api/v1/os/login` returns a signed, expiring token plus the staff profile.
 * The token is sent as a bearer credential on OS API calls and is validated
 * server-side (`/os/me`); the profile personalises the UI. Expiry is enforced
 * both client-side (fast redirect) and server-side (authoritative).
 */

export interface OsSession {
  staffId: string | null;
  name: string;
  role: string;
  roleLabel: string;
  department: string;
  specialty: string | null;
  token: string;
  /** Epoch seconds when the token expires. */
  expiresAt: number;
}

const STORAGE_KEY = "cliniq.os.session";

export function getOsSession(): OsSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as OsSession;
    // Client-side expiry check (server enforces the real one).
    if (!session.token || (session.expiresAt && session.expiresAt * 1000 <= Date.now())) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getOsToken(): string | null {
  return getOsSession()?.token ?? null;
}

export function osAuthHeader(): Record<string, string> {
  const token = getOsToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

/** Authoritative server-side validation of the stored token. Throws on 401. */
export async function fetchOsMe(): Promise<{ name: string; role: string; roleLabel: string; department: string }> {
  const res = await fetch("/api/v1/os/me", {
    headers: { Accept: "application/json", ...osAuthHeader() },
  });
  if (!res.ok) throw new Error(`os/me → ${res.status}`);
  return await res.json();
}
