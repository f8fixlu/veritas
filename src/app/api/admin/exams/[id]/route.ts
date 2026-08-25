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
  const data: {
    title?: string;
    description?: string | null;
    durationMinutes?: number;
    pointsPerQuestion?: number;
    published?: boolean;
    showResult?: boolean;
    randomize?: boolean;
  } = {};

  if (body && typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (body && body.durationMinutes !== undefined) {
    const d = Number(body.durationMinutes);
    if (!Number.isInteger(d) || d < 1 || d > 600) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 600 minutes." },
        { status: 400 }
      );
    }
    data.durationMinutes = d;
  }
  if (body && body.pointsPerQuestion !== undefined) {
    const p = Number(body.pointsPerQuestion);
    if (!Number.isInteger(p) || p < 1 || p > 100) {
      return NextResponse.json(
        { error: "Points per question must be between 1 and 100." },
        { status: 400 }
      );
    }
    data.pointsPerQuestion = p;
  }
  if (body && typeof body.published === "boolean") {
    data.published = body.published;
  }
  if (body && typeof body.showResult === "boolean") {
    data.showResult = body.showResult;
  }
  if (body && typeof body.randomize === "boolean") {
    data.randomize = body.randomize;
  }

  try {
    await getDb().exam.update({ where: { id }, data });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }
    console.error("[exam:update]", err);
    return NextResponse.json(
      { error: "Could not update the exam." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { examId: id } } }),
    db.attempt.deleteMany({ where: { examId: id } }),
    db.question.deleteMany({ where: { examId: id } }),
    db.exam.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
