/**
 * Requests from the new UI to the City Healer server.
 *
 * There is no silent fallback to browser-stored sample data (the old app had one): if the
 * server fails, the caller gets an error and the screen says so. A screen showing results
 * that came from nowhere was one of the reasons the old app "did not work".
 */
import { auth } from "../../firebase";
import { getDemoSessionRole } from "./demo";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function request<T>(url: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("network", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The server refuses patient routes without a valid, current consent (also after a
    // withdrawal, or when the terms change mid-session). Tell the session, which re-reads the
    // account and sends the person to review the terms.
    if (res.status === 403 && data.error === "CONSENT_REQUIRED") window.dispatchEvent(new Event(CONSENT_REQUIRED_EVENT));
    throw new ApiError(data.error || `HTTP ${res.status}`, res.status);
  }
  return data as T;
}

/** Fired on window when the server answers 403 CONSENT_REQUIRED. */
export const CONSENT_REQUIRED_EVENT = "ch:consent-required";

export const isDemo = () => !!getDemoSessionRole();
