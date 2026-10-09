import { NextResponse } from "next/server";

/**
 * Small in-memory fixed-window rate limiter. Veritas is a single Node process
 * talking to SQLite, so a process-local counter is enough to stop an attacker
 * from turning the public auth endpoints (each of which does synchronous bcrypt
 * work) into a CPU/SQLite denial of service. It intentionally adds no DB writes
 * on the hot path.
 *
 * Keys are namespaced by the caller, e.g. `login:ip:<ip>` or
 * `login:account:<email>`, so one limiter covers every endpoint.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000;
let lastPrune = 0;

function prune(now: number): void {
  if (now - lastPrune < 60_000 && buckets.size <= MAX_KEYS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    let excess = buckets.size - MAX_KEYS;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--excess <= 0) break;
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/** Records one hit against `key` and reports whether it stays under `limit`. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears a bucket, e.g. after a successful login so a real user is never locked out. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
