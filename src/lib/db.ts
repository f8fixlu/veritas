import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  __veritasPrisma?: PrismaClient;
};

export function getDb(): PrismaClient {
  const cached = globalForPrisma.__veritasPrisma;
  if (cached) return cached;

  const adapter = new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  });
  const client = new PrismaClient({ adapter });
  globalForPrisma.__veritasPrisma = client;
  return client;
}
