/**
 * Session layer for the patient portal (`/portal`).
 *
 * `/api/v1/os/portal/login` resolves the sign-in identifier to a patient record
 * and returns a patient-scoped, expiring bearer token. The token is validated
 * server-side (`/portal/me`) and only ever exposes that one patient's data.
 */

export interface PortalSession {
  patientId: string;
  name: string;
  mrn: string | null;
  token: string;
  /** Epoch seconds when the token expires. */
  expiresAt: number;
}

const STORAGE_KEY = "cliniq.portal.session";

export function getPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PortalSession;
    if (!session.token || (session.expiresAt && session.expiresAt * 1000 <= Date.now())) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getPortalToken(): string | null {
  return getPortalSession()?.token ?? null;
}

export function portalAuthHeader(): Record<string, string> {
  const token = getPortalToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setPortalSession(session: PortalSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPortalSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Two-letter avatar initials from a name (e.g. "Kavitha Nair" → "KN"). */
export function portalInitials(name: string): string {
  const words = name.replace(/^dr\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PT";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export async function portalLoginRequest(input: {
  username: string;
  password: string;
}): Promise<PortalSession> {
  const res = await fetch("/api/v1/os/portal/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...input, role: "Patient" }),
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
  return (await res.json()) as PortalSession;
}
