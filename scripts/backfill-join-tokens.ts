import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateJoinToken } from "../src/lib/tokens";

/**
 * One-off backfill for subject enrollment tokens introduced alongside the
 * ownership split. Subjects created before `joinToken` existed have NULL here;
 * this stamps each one with a fresh unique token.
 *
 * Safe to re-run: subjects that already have a token are left untouched, and
 * collisions are retried against the unique constraint.
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const subjects = await db.subject.findMany({
    where: { joinToken: null },
    select: { id: true },
  });
  if (subjects.length === 0) {
    console.log("Every subject already has an enrollment token. Nothing to do.");
    return;
  }

  let assigned = 0;
  for (const subject of subjects) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const token = generateJoinToken();
      try {
        await db.subject.update({
          where: { id: subject.id },
          data: { joinToken: token },
        });
        assigned++;
        break;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "P2002") throw err;
      }
    }
  }

  console.log(`Assigned enrollment tokens to ${assigned} subject(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());