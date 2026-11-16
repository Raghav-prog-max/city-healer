/**
 * Fixed-window rate limiter (Milestone 4: A14), used by aiRateLimit in server.ts.
 *
 * Each key gets a window that starts at its first request and lasts `windowMs`. Requests are
 * counted in the window; request number limit+1 and later are refused until the window ends,
 * then the next request opens a fresh window. O(1) time per request; O(keys) memory, pruned
 * of expired windows once more than `maxKeys` are held. In-memory: resets on restart and is
 * per process (a shared store such as Redis is needed for several servers).
 */

export interface LimitDecision {
  allowed: boolean;
  count: number;
  remaining: number;
  /** Seconds until the window ends (meaningful when refused). */
  retryAfterSeconds: number;
}

export interface FixedWindowLimiter {
  hit(key: string): LimitDecision;
  size(): number;
  readonly limit: number;
  readonly windowMs: number;
}

export function createFixedWindowLimiter(opts: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }): FixedWindowLimiter {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 5000;
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { count: number; windowStart: number }>();

  return {
    limit,
    windowMs,
    size: () => windows.size,
    hit(key) {
      const t = now();
      // Opportunistic prune so the map cannot grow without bound.
      if (windows.size > maxKeys) {
        for (const [k, v] of windows) if (t - v.windowStart > windowMs) windows.delete(k);
      }
      let entry = windows.get(key);
      if (!entry || t - entry.windowStart > windowMs) {
        entry = { count: 0, windowStart: t };
        windows.set(key, entry);
      }
      entry.count += 1;
      const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - t) / 1000);
      return { allowed: entry.count <= limit, count: entry.count, remaining: Math.max(0, limit - entry.count), retryAfterSeconds };
    },
  };
}
