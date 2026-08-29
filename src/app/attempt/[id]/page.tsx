import { notFound, redirect } from "next/navigation";
import ExamRunner from "@/components/student/exam-runner";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  attemptEndsAt,
  finalizeIfExpired,
  orderedExamQuestions,
  scrambleQuestionOptions,
} from "@/lib/exam";
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
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              section: {
                select: { name: true, details: true, pointsPerQuestion: true },
              },
            },
          },
        },
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

  // Group questions by section (in first-appearance order), optionally
  // shuffling within each section, so section headers stay contiguous.
  const questions = orderedExamQuestions(
    attempt.exam.questions,
    attempt.id,
    attempt.exam.randomize
  );

  return (
    <ExamRunner
      attemptId={attempt.id}
      examTitle={attempt.exam.title}
      endsAtISO={endsAt.toISOString()}
      initialAnswers={initialAnswers}
      questions={questions.map((q) => ({
        id: q.id,
        text: q.text,
        // Identity-scramble the four options: each option keeps its canonical
        // letter (what's stored/graded) but is labelled with a different
        // display letter per attempt, so a letter-based "answer key" recorded
        // in one session does not line up with another student's session.
        options: scrambleQuestionOptions(q, attempt.id),
        sectionId: q.sectionId ?? null,
        sectionName: q.section?.name ?? null,
        sectionDetails: q.section?.details ?? null,
        sectionPoints: q.section?.pointsPerQuestion ?? null,
      }))}
    />
  );
}
