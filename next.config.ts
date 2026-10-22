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
  experimental: {
    // Next 16 stops `next build`/`next dev` to advertise a security-advisory
    // upgrade. There is nobody to answer that prompt on an unattended
    // `install.sh`/`update.sh` build, so it aborted with BUILD_ID missing.
    // Reminders off: upgrades are handled deliberately via package.json.
    agentUpgrade: false,
  },
};

export default nextConfig;
