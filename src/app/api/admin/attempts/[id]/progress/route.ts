import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent, ownedAttemptWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns this exam can watch a student live." },
      { status: 403 }
    );
  }

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, ...ownedAttemptWhere(user) },
    select: {
      examId: true,
      submittedAt: true,
      focusLosses: true,
      totalFocusLossMs: true,
      maxBlurMs: true,
    },
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
    focusLosses: attempt.focusLosses ?? 0,
    totalFocusLossMs: attempt.totalFocusLossMs ?? 0,
    maxBlurMs: attempt.maxBlurMs ?? 0,
  });
}
