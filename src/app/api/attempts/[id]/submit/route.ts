import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type IncomingAnswer = { questionId: number; selected: string | null };

function parseAnswers(input: unknown): IncomingAnswer[] {
  if (!Array.isArray(input)) return [];
  const out: IncomingAnswer[] = [];
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
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }
  if (attempt.submittedAt) {
    return NextResponse.json(
      { error: "This attempt was already submitted.", attemptId },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const answers = parseAnswers(body?.answers);
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.selected]));

  const questions = await db.question.findMany({
    where: { examId: attempt.examId },
    include: { section: { select: { pointsPerQuestion: true } } },
  });
  const defaultPpq = attempt.exam.pointsPerQuestion;

  let score = 0;
  let total = 0;
  const rows = questions.map((q) => {
    const ppq = q.section?.pointsPerQuestion ?? defaultPpq;
    total += ppq;
    const selected = byQuestion.get(q.id) ?? null;
    const isCorrect = selected !== null && selected === q.correctOption;
    if (isCorrect) score += ppq;
    return {
      attemptId,
      questionId: q.id,
      selectedOption: selected,
      isCorrect,
    };
  });

  const submittedAt = new Date();
  await db.$transaction([
    db.answer.deleteMany({ where: { attemptId } }),
    db.answer.createMany({ data: rows }),
    db.attempt.update({
      where: { id: attemptId },
      data: { submittedAt, score, total },
    }),
  ]);

  return NextResponse.json({ ok: true, attemptId, score, total });
}
