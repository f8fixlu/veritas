import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: { examId: true, submittedAt: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const [answered, total] = await Promise.all([
    db.answer.count({
      where: { attemptId, selectedOption: { not: null } },
    }),
    db.question.count({ where: { examId: attempt.examId } }),
  ]);

  return NextResponse.json({
    answered,
    total,
    submittedAtISO: attempt.submittedAt?.toISOString() ?? null,
  });
}
