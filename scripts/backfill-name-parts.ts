import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * One-off backfill for the first/middle/last name split introduced alongside
 * the profile page. Accounts created before these fields existed have a
 * single composite `name`; this derives firstName/middleName/lastName from it
 * so every row has the parts populated.
 *
 * Safe to re-run: rows that already have a firstName are left untouched.
 *
 * Split rule: first token → firstName, last token → lastName, any tokens in
 * between → middleName. A single-word name becomes firstName with an empty
 * lastName (lastName is nullable for legacy rows).
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const users = await db.user.findMany({
    where: { firstName: null },
    select: { id: true, name: true },
  });
  if (users.length === 0) {
    console.log("Every user already has name parts. Nothing to do.");
    return;
  }

  let updated = 0;
  for (const user of users) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    const middleName =
      parts.length > 2 ? parts.slice(1, -1).join(" ") : null;

    await db.user.update({
      where: { id: user.id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        middleName,
      },
    });
    console.log(`${user.name}: first=${firstName || "—"} middle=${middleName || "—"} last=${lastName || "—"}`);
    updated++;
  }

  console.log(`Backfilled name parts for ${updated} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
