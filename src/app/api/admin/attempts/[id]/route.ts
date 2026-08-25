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
    include: {
      user: { select: { name: true, email: true } },
      exam: {
        include: {
          subject: true,
          questions: {
            orderBy: { order: "asc" },
            include: {
              section: { select: { name: true, details: true } },
            },
          },
        },
      },
      answers: true,
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const answersByQuestion = new Map(
    attempt.answers.map((a) => [a.questionId, a])
  );

  const questions = attempt.exam.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    return {
      id: question.id,
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOption: question.correctOption,
      selected: answer?.selectedOption ?? null,
      sectionId: question.sectionId ?? null,
      sectionName: question.section?.name ?? null,
      sectionDetails: question.section?.details ?? null,
    };
  });

  return NextResponse.json({
    id: attempt.id,
    studentName: attempt.user.name,
    studentEmail: attempt.user.email,
    examTitle: attempt.exam.title,
    subjectName: attempt.exam.subject.name,
    startedAtISO: attempt.startedAt.toISOString(),
    submittedAtISO: attempt.submittedAt?.toISOString() ?? null,
    score: attempt.score,
    total: attempt.total,
    questions,
  });
}
