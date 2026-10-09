import { tooMany } from "./errors";

/**
 * Fixed-window in-memory rate limiter.
 * Good for a single instance; for multi-instance deployments back this with Redis/Upstash
 * (the call sites stay the same).
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export const LIMITS = {
  auth: { max: 10, windowMs: 60_000 },
  vote: { max: 60, windowMs: 60_000 },
  boost: { max: 40, windowMs: 60_000 },
  comment: { max: 8, windowMs: 60_000 },
  message: { max: 20, windowMs: 60_000 },
  create: { max: 6, windowMs: 60 * 60_000 },
  upload: { max: 20, windowMs: 60 * 60_000 },
  report: { max: 20, windowMs: 60 * 60_000 },
  search: { max: 90, windowMs: 60_000 },
  checkout: { max: 10, windowMs: 60_000 },
} as const;

export function rateLimit(key: string, limit: { max: number; windowMs: number }) {
  if (process.env.RATE_LIMIT_DISABLED === "true") return;
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    lastSweep = now;
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + limit.windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit.max) {
    const secs = Math.ceil((bucket.resetAt - now) / 1000);
    throw tooMany(`Too many requests — try again in ${secs}s.`);
  }
}
