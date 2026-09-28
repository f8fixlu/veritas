import { NextResponse } from "next/server";
import { requireApiAdmin, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAttemptSnapshots } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  if (user.role !== ROLES.INSTRUCTOR) {
    return NextResponse.json(
      { error: "Only instructor accounts can be deleted here." },
      { status: 400 }
    );
  }

  // Subjects (and the exams, questions and results under them) belong to the
  // instructor, so removal has to be an explicit decision by the admin rather
  // than silently stranding or destroying that content.
  const ownedSubjects = await db.subject.findMany({
    where: { ownerId: id },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  if (ownedSubjects.length > 0) {
    return NextResponse.json(
      {
        error:
          "This instructor still owns subjects. Delete those subjects first " +
          `(or hand their content over) before removing the account: ` +
          ownedSubjects.map((s) => s.name).join(", ") +
          ".",
        subjects: ownedSubjects.map((s) => s.name),
      },
      { status: 409 }
    );
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
