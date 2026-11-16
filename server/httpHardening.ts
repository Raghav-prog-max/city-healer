/**
 * HTTP hardening for server.ts (audit S-05, S-06, BUG-015): security headers on every
 * response, JSON bodies for parser and unhandled errors, and a general write rate limit.
 * Written by hand so the server takes no new dependency (helmet, express-rate-limit).
 */
import type express from "express";
import { createFixedWindowLimiter } from "./rateLimit";

/**
 * Content-Security-Policy for the built frontend. Only set in production: Vite's dev server
 * injects inline scripts and talks over a websocket for HMR.
 * - Firebase Auth calls identitytoolkit and securetoken; phone sign-in renders an invisible
 *   reCAPTCHA (www.google.com / www.gstatic.com) and Auth may use its firebaseapp.com iframe
 *   and apis.google.com loader. Firestore is listed for any client read.
 * - Fonts come from Google Fonts; the landing page images come from images.unsplash.com.
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://www.gstatic.com",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com",
  "frame-src 'self' https://*.firebaseapp.com https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
  "worker-src 'self' blob:",
].join("; ");

export function securityHeaders(opts: { production: boolean }) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Voice input needs the microphone; nothing in the site uses the camera.
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(self)");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (opts.production) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader("Content-Security-Policy", PRODUCTION_CSP);
    }
    next();
  };
}

/**
 * Registered straight after express.json(): a malformed or oversized body gets a JSON
 * answer instead of Express's HTML page, which echoed the parser message.
 */
export function bodyParserErrors(err: any, _req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "INVALID_JSON" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
  next(err);
}

/** Registered last: an unhandled error is a JSON 500 with no stack trace or message. */
export function finalErrorHandler(err: any, _req: express.Request, res: express.Response, next: express.NextFunction) {
  console.error("[Unhandled]", err);
  if (res.headersSent) return next(err);
  const status = Number(err?.status || err?.statusCode);
  if (status >= 400 && status < 500) return res.status(status).json({ error: "BAD_REQUEST" });
  res.status(500).json({ error: "INTERNAL_ERROR" });
}

const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
};

/**
 * Fixed-window limit on writes (POST/PUT/PATCH/DELETE), per uid for signed-in callers and per
 * IP for anonymous or shared demo callers. Reads pass through. `envPrefix` names the
 * overrides, e.g. WRITE_RATE_LIMIT / WRITE_RATE_WINDOW_MS, or SOS_RATE_LIMIT / SOS_RATE_WINDOW_MS.
 */
export function writeRateLimit(opts: {
  name: string;
  envPrefix: string;
  limit: number;
  windowMs: number;
  getUser: (req: express.Request) => { uid: string; isDemo?: boolean } | null | undefined;
}) {
  const limiter = createFixedWindowLimiter({
    limit: envInt(`${opts.envPrefix}_RATE_LIMIT`, opts.limit),
    windowMs: envInt(`${opts.envPrefix}_RATE_WINDOW_MS`, opts.windowMs),
  });
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const user = opts.getUser(req);
    const key = user && !user.isDemo ? `uid:${user.uid}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const decision = limiter.hit(`${opts.name}:${key}`);
    if (!decision.allowed) {
      res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      return res.status(429).json({ error: "RATE_LIMITED", message: "Too many requests. Please wait and try again.", retryAfterSeconds: decision.retryAfterSeconds });
    }
    next();
  };
}
