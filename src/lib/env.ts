const DEV_FALLBACK_SECRET = "veritas-dev-secret-change-me";

export const AUTH_SECRET_REQUIRED_MESSAGE =
  "AUTH_SECRET is required in production and is not set. Generate one with " +
  '`node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
  "and set it in .env before starting the server.";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The HMAC key for session tokens. A production server must never sign with a
 * value an attacker can read straight from the source, so callers must have
 * passed `assertAuthSecretConfigured()` first; the fallback exists only for
 * local development, where `.env` is optional.
 */
export function authSecretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  return new TextEncoder().encode(value || DEV_FALLBACK_SECRET);
}

/**
 * Throws when a production process is missing AUTH_SECRET. Call at module load
 * (so signing can never use the fallback) and at server startup (so the
 * process refuses to run rather than serving with a forgeable secret).
 */
export function assertAuthSecretConfigured(): void {
  if (!process.env.AUTH_SECRET && isProduction()) {
    throw new Error(AUTH_SECRET_REQUIRED_MESSAGE);
  }
}
