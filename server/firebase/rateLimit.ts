/**
 * A small in-memory, per-account request limiter for the appointment routes (messages, and the
 * check-in queue poll). Fixed window per uid: `limit` requests per `windowMs`, then 429 with a
 * Retry-After header (seconds) until the window ends.
 *
 * Each call to rateLimit() makes its own counter, so the message post limiter and the poll
 * limiter do not share a budget, and neither shares the AI bucket in server.ts.
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
}

export function rateLimit({ limit, windowMs }: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { count: number; start: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as AuthUser | undefined;
    if (!u) return res.status(401).json({ error: "Authentication required." });
    const now = Date.now();
    // Opportunistic prune so the map cannot grow without bound.
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    const w = windows.get(u.uid);
    if (!w || now - w.start >= windowMs) {
      windows.set(u.uid, { count: 1, start: now });
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
