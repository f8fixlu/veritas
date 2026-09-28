import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canDeleteContent, canManageContent, ownedSubjectWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns a subject can edit it." },
      { status: 403 }
    );
  }

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const existing = await db.subject.findFirst({
    where: { id, ...ownedSubjectWhere(user) },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const data: { name?: string; description?: string | null } = {};
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  if (name) data.name = name;
  data.description = description || null;

  try {
    await db.subject.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Could not update subject. The name may already be in use." },
        { status: 409 }
      );
    }
    console.error("[subject:update]", err);
    return NextResponse.json(
      { error: "Could not update the subject." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteContent(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  // Admins may delete any subject; instructors only their own.
  const subject = await db.subject.findFirst({
    where: { id, ...(canManageContent(user) ? ownedSubjectWhere(user) : {}) },
  });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const exams = await db.exam.findMany({ where: { subjectId: id }, select: { id: true } });
  const examIds = exams.map((e) => e.id);

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { examId: { in: examIds } } } }),
    db.attempt.deleteMany({ where: { examId: { in: examIds } } }),
    db.question.deleteMany({ where: { examId: { in: examIds } } }),
    db.exam.deleteMany({ where: { subjectId: id } }),
    db.enrollment.deleteMany({ where: { subjectId: id } }),
    db.subject.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
