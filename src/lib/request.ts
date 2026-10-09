/**
 * Best-effort client IP for logging and rate limiting. `x-forwarded-for` is
 * trusted first because Veritas is served behind a reverse proxy that sets it;
 * the fallbacks cover the common platform headers. Returns null when no header
 * is present (e.g. direct localhost access).
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  for (const header of ["x-real-ip", "cf-connecting-ip"]) {
    const value = req.headers.get(header);
    if (value) return value.trim();
  }
  return null;
}
