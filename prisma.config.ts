import path from "node:path";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not load .env on its own. Load it here so CLI commands
// (db push, seed helpers, studio) resolve the same VERITAS_DB_FILE the server
// uses instead of silently falling back to ./prisma/dev.db. Existing process
// environment variables keep precedence; a missing .env is fine.
try {
  process.loadEnvFile();
} catch {
  // no .env present — fall back to the defaults below
}

const databaseFile =
  process.env.VERITAS_DB_FILE ?? path.join(process.cwd(), "prisma", "dev.db");

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: `file:${databaseFile}`,
  },
});
