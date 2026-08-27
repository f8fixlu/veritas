import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseSelections(input: unknown): { questionId: number; selected: string | null }[] {
  if (!Array.isArray(input)) return [];
  const out: { questionId: number; selected: string | null }[] = [];
  for (const item of input) {
    const questionId = Number(item?.questionId);
    if (!Number.isInteger(questionId)) continue;
    const raw = String(item?.selected ?? "").toUpperCase();
    const selected = /^[ABCD]$/.test(raw) ? raw : null;
    out.push({ questionId, selected });
  }
  return out;
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const attempt = await db.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }
  if (attempt.submittedAt) {
    return NextResponse.json(
      { error: "This attempt was already submitted." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const selections = parseSelections(body?.answers);
  const focus = body?.focus;

  const focusData =
    focus && typeof focus === "object"
      ? {
          focusLosses: Number.isFinite(focus.losses) ? Number(focus.losses) : 0,
          totalFocusLossMs: Number.isFinite(focus.totalMs)
            ? Number(focus.totalMs)
            : 0,
          maxBlurMs: Number.isFinite(focus.maxMs) ? Number(focus.maxMs) : 0,
          focusLossAt: new Date(),
        }
      : null;

  const questionIds = new Set(
    (
      await db.question.findMany({
        where: { examId: attempt.examId },
        select: { id: true },
      })
    ).map((q) => q.id)
  );

  const rows = selections
    .filter((s) => questionIds.has(s.questionId))
    .map((s) => ({
      attemptId,
      questionId: s.questionId,
      selectedOption: s.selected,
      isCorrect: false,
    }));

  await db.$transaction([
    db.answer.deleteMany({ where: { attemptId } }),
    ...(rows.length > 0 ? [db.answer.createMany({ data: rows })] : []),
    ...(focusData
      ? [db.attempt.update({ where: { id: attemptId }, data: focusData })]
      : []),
  ]);

  return NextResponse.json({ ok: true, saved: rows.length });
}
