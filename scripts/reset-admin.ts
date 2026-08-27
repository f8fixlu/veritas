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
  const email = process.env.ADMIN_EMAIL ?? "admin@veritas.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash: bcrypt.hashSync(password, 10), role: "ADMIN" },
    create: {
      name: "Administrator",
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "ADMIN",
    },
  });

  const check = await db.user.findUnique({ where: { email } });
  const ok = bcrypt.compareSync(password, check!.passwordHash);

  const all = await db.user.findMany({
    select: { id: true, email: true, role: true, emailVerifiedAt: true },
    orderBy: { id: "asc" },
  });

  console.log(`Admin ${email} password reset to "${password}" -> ${ok ? "OK" : "FAILED"}`);
  console.log(`User table (${all.length} rows):`);
  for (const u of all) console.log(`  #${u.id} ${u.email} [${u.role}] verified=${u.emailVerifiedAt ? "yes" : "no"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
