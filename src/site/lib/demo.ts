/**
 * "Try the demo": a browser exploring without an account. The role being explored is kept in
 * localStorage so a reload restores it. Such a visitor holds no token, so the server answers
 * every guarded route with 401/403; this flag only changes what the screens offer. It never
 * loosens anything server-side.
 *
 * Pass null to clear it, which a real sign-in and a sign-out both do.
 */
const DEMO_SESSION_KEY = "city_healer_demo_session";

export function setDemoSession(role: string | null): void {
  try {
    if (role) localStorage.setItem(DEMO_SESSION_KEY, role);
    else localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* storage blocked (private mode); demo simply stays off */
  }
}

export function getDemoSessionRole(): string | null {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY);
  } catch {
    return null;
  }
}
