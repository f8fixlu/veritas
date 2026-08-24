import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const data: { name?: string; description?: string | null } = {};
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  if (name) data.name = name;
  data.description = description || null;

  try {
    const db = getDb();
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
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const subject = await db.subject.findUnique({ where: { id } });
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
