import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAttemptSnapshots } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Deleting a student removes their enrollments and every attempt they have
 * taken, in any instructor's exams — so this stays an admin action. Instructors
 * enroll and unenroll students in their own subjects instead.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const student = await db.user.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (student.role !== "STUDENT") {
    return NextResponse.json({ error: "Only student accounts can be deleted." }, { status: 400 });
  }

  const attemptIds = (
    await db.attempt.findMany({
      where: { userId: id },
      select: { id: true },
    })
  ).map((a) => a.id);

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { userId: id } } }),
    db.attempt.deleteMany({ where: { userId: id } }),
    db.enrollment.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ]);

  for (const attemptId of attemptIds) {
    await deleteAttemptSnapshots(attemptId);
  }

  return NextResponse.json({ ok: true });
}
