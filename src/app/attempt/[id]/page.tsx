import { notFound, redirect } from "next/navigation";
import ExamRunner from "@/components/student/exam-runner";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attemptEndsAt, finalizeIfExpired } from "@/lib/exam";
import { nowMs } from "@/lib/format";

export const metadata = { title: "Taking exam — Veritas" };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const attemptId = Number((await params).id);
  if (!Number.isInteger(attemptId)) notFound();

  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      exam: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.submittedAt) redirect(`/result/${attempt.id}`);

  const endsAt = attemptEndsAt(attempt, attempt.exam.durationMinutes);
  if (nowMs() >= endsAt.getTime()) {
    await finalizeIfExpired(attempt, attempt.exam.durationMinutes);
    redirect(`/result/${attempt.id}`);
  }

  const initialAnswers: Record<number, string> = {};
  for (const answer of attempt.answers) {
    if (
      answer.selectedOption &&
      /^[ABCD]$/.test(answer.selectedOption)
    ) {
      initialAnswers[answer.questionId] = answer.selectedOption;
    }
  }

  return (
    <ExamRunner
      attemptId={attempt.id}
      examTitle={attempt.exam.title}
      endsAtISO={endsAt.toISOString()}
      initialAnswers={initialAnswers}
      questions={attempt.exam.questions.map((q) => ({
        id: q.id,
        text: q.text,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
      }))}
    />
  );
}
