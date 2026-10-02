import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateStudentCode } from "../src/lib/tokens";

/**
 * One-off backfill for instructor student codes introduced alongside the
 * student→instructor link. Instructors created before `studentCode` existed
 * have NULL here; this stamps each one with a fresh unique code so students
 * can register against them.
 *
 * Safe to re-run: instructors that already have a code are left untouched,
 * and collisions are retried against the unique constraint.
 */
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const instructors = await db.user.findMany({
    where: { role: "INSTRUCTOR", studentCode: null },
    select: { id: true, name: true },
  });
  if (instructors.length === 0) {
    console.log("Every instructor already has a student code. Nothing to do.");
    return;
  }

  let assigned = 0;
  for (const instructor of instructors) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = generateStudentCode();
      try {
        await db.user.update({
          where: { id: instructor.id },
          data: { studentCode: code },
        });
        console.log(`${instructor.name}: ${code}`);
        assigned++;
        break;
      } catch (err) {
        const errCode = (err as { code?: string }).code;
        if (errCode !== "P2002") throw err;
      }
    }
  }

  console.log(`Assigned student codes to ${assigned} instructor(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());