import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const result = await db.user.upsert({
    where: { email: "admin@veritas.local" },
    update: {},
    create: {
      name: "Administrator",
      email: "admin@veritas.local",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
    },
  });
  console.log(
    `Admin account ready: admin@veritas.local (${bcrypt.compareSync("admin123", result.passwordHash) ? "password is admin123" : "existing password kept"})`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
