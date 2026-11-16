/**
 * A small in-memory, per-account request limiter for the appointment routes (messages, and the
 * check-in queue poll). Fixed window per uid: `limit` requests per `windowMs`, then 429 with a
 * Retry-After header (seconds) until the window ends.
 *
 * Each call to rateLimit() makes its own counter, so the message post limiter and the poll
 * limiter do not share a budget, and neither shares the AI bucket in server.ts.
 *
 * By default the counter is per uid. `perAppointment` counts per uid and appointment instead,
 * for routes a screen polls once per open panel: a doctor with several message panels open, or
 * a patient with a thread and their place in the line on screen, then has a budget per panel,
 * and one panel can never starve another. Pair it with a per-uid ceiling (a second limiter)
 * so the total stays bounded.
 *
 * In memory and per process, like aiRateLimit: with several server processes each one counts
 * on its own. The durable bounds are the 200-message thread cap and the check-in cap.
 *
 * Mount it after the role guard: an anonymous caller is answered 401 here as well, so it can
 * never be counted against somebody else's budget.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthUser } from "./identity";

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Count per uid and :appointmentId rather than per uid. */
  perAppointment?: boolean;
}

export function rateLimit({ limit, windowMs, perAppointment = false }: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { count: number; start: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as AuthUser | undefined;
    if (!u) return res.status(401).json({ error: "Authentication required." });
    const now = Date.now();
    // Opportunistic prune so the map cannot grow without bound.
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    const key = perAppointment ? `${u.uid}/${String(req.params?.appointmentId ?? "")}` : u.uid;
    const w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      windows.set(key, { count: 1, start: now });
      return next();
    }
    if (w.count >= limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((w.start + windowMs - now) / 1000))));
      return res.status(429).json({ error: "Too many requests. Please wait a moment and try again.", code: "RATE_LIMITED" });
    }
    w.count++;
    next();
  };
}
