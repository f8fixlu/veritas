import { NextResponse } from "next/server";
import { requireApiStaff, verifyUserPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAttemptSnapshots } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Deleting a student removes their enrollments and every attempt they have
 * taken, in any instructor's exams — so this stays a staff action. The admin
 * can delete any student; an instructor can only delete a student linked to
 * them (`User.instructorId`). The caller must confirm with their own password
 * before the deletion goes through.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json(
      { error: "Enter your password to confirm." },
      { status: 400 }
    );
  }
  if (!(await verifyUserPassword(user.id, password))) {
    return NextResponse.json(
      { error: "Your password was incorrect." },
      { status: 401 }
    );
  }

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const student = await db.user.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (student.role !== "STUDENT") {
    return NextResponse.json({ error: "Only student accounts can be deleted." }, { status: 400 });
  }
  // Admins can delete any student. An instructor can only delete a student
  // linked to them; another instructor's student is indistinguishable from
  // "does not exist" (404) so ids never leak existence.
  if (user.role !== "ADMIN" && student.instructorId !== user.id) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
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
