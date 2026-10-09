import type { NextConfig } from "next";
import { assertAuthSecretConfigured } from "./src/lib/env";

assertAuthSecretConfigured();

// Next 16 blocks cross-origin requests to dev-only resources (e.g. HMR) by
// default, which logs a warning when the dev server is reached by IP/hostname
// (http://192.168.5.231:3000). Add extra dev origins as a comma-separated list
// in VERITAS_DEV_ORIGINS. Dev-only — `next start` ignores this.
const allowedDevOrigins = (process.env.VERITAS_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "resend"],
  allowedDevOrigins: allowedDevOrigins.length > 0 ? allowedDevOrigins : undefined,
};

export default nextConfig;
