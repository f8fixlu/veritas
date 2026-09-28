import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * One-off backfill for the per-instructor subject ownership introduced in
 * v1.0.4. Subjects created before ownership existed have `ownerId = NULL`; this
 * stamps them with the oldest INSTRUCTOR account (falling back to the oldest
 * staff account of any role) so an existing install keeps working and stays
 * fully manageable.
 *
 * Safe to re-run: subjects that already have an owner are left untouched.
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const orphanCount = await db.subject.count({ where: { ownerId: null } });
  if (orphanCount === 0) {
    console.log("Every subject already has an owner. Nothing to do.");
    return;
  }

  const owner =
    (await db.user.findFirst({
      where: { role: "INSTRUCTOR" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.user.findFirst({
      where: { role: { in: ["ADMIN", "INSTRUCTOR"] } },
      orderBy: { createdAt: "asc" },
    }));

  if (!owner) {
    console.error(
      `Cannot assign the ${orphanCount} existing subject(s): no admin or instructor account exists yet. ` +
        "Create an instructor in the admin panel, then re-run: npx tsx scripts/backfill-subject-owners.ts"
    );
    process.exit(1);
  }

  const { count } = await db.subject.updateMany({
    where: { ownerId: null },
    data: { ownerId: owner.id },
  });

  console.log(
    `Assigned ${count} subject(s) to ${owner.name} <${owner.email}> (${owner.role.toLowerCase()}, id ${owner.id}).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
