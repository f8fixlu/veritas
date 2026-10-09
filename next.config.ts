import type { NextConfig } from "next";
import { assertAuthSecretConfigured } from "./src/lib/env";

assertAuthSecretConfigured();

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "resend"],
};

export default nextConfig;
