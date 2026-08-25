import path from "node:path";
import { defineConfig } from "prisma/config";

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
