import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Migrates legacy single-instructor links and links students to instructors
 * whose subjects they have already joined. Safe to rerun; each pair is
 * upserted through its composite primary key.
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
    where: { role: "INSTRUCTOR" },
    select: { id: true },
  });
  const instructorIds = new Set(instructors.map((instructor) => instructor.id));
  const links = new Map<string, { studentId: number; instructorId: number }>();

  const legacyStudents = await db.user.findMany({
    where: { role: "STUDENT", instructorId: { not: null } },
    select: { id: true, instructorId: true },
  });
  for (const student of legacyStudents) {
    if (student.instructorId && instructorIds.has(student.instructorId)) {
      const link = {
        studentId: student.id,
        instructorId: student.instructorId,
      };
      links.set(`${link.studentId}:${link.instructorId}`, link);
    }
  }

  const existingEnrollments = await db.enrollment.findMany({
    where: {
      user: { role: "STUDENT" },
      subject: { ownerId: { not: null } },
    },
    select: { userId: true, subject: { select: { ownerId: true } } },
  });
  for (const enrollment of existingEnrollments) {
    const instructorId = enrollment.subject.ownerId;
    if (instructorId && instructorIds.has(instructorId)) {
      const link = { studentId: enrollment.userId, instructorId };
      links.set(`${link.studentId}:${link.instructorId}`, link);
    }
  }

  if (links.size === 0) {
    console.log("Every existing student-instructor link is already backfilled.");
    return;
  }

  for (const link of links.values()) {
    await db.instructorStudent.upsert({
      where: {
        studentId_instructorId: {
          studentId: link.studentId,
          instructorId: link.instructorId,
        },
      },
      create: link,
      update: {},
    });
  }
  console.log(`Ensured ${links.size} student-instructor link(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
