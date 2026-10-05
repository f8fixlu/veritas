import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  canDeleteContent,
  canManageContent,
  isAdmin,
  ownedAttemptWhere,
} from "@/lib/scope";
import { orderedExamQuestions, scrambleQuestionOptions } from "@/lib/exam";
import { deleteAttemptSnapshots } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Reset a submitted attempt so the student can sit the exam again: drops the
 * attempt, its answers and its camera snapshots. Used when an exam had to be
 * voided (technical failure, suspected cheating, an invalidated paper). The
 * student is not the caller, so the `@@unique([examId, userId])` constraint is
 * free again once the row is gone and they can start a new attempt.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDeleteContent(user)) {
    return NextResponse.json(
      { error: "Only staff can reset an exam attempt." },
      { status: 403 }
    );
  }

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  // Admins are delete-only everywhere else, so they see every attempt; an
  // instructor only ever reaches the attempts from their own exams (404 for
  // anything else, so ids don't leak existence).
  const attempt = await db.attempt.findFirst({
    where: {
      id: attemptId,
      ...(isAdmin(user) ? {} : ownedAttemptWhere(user)),
    },
    select: { id: true, submittedAt: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (!attempt.submittedAt) {
    return NextResponse.json(
      { error: "This attempt is still in progress — the student can finish it themselves." },
      { status: 409 }
    );
  }

  await deleteAttemptSnapshots(attemptId);
  await db.attempt.delete({ where: { id: attemptId } });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns this exam can review its results." },
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

  // Reproduce the exact question order (per-section, seed-randomized) and
  // scrambled option layout the student saw, so the admin review lines up
  // with what they answered.
  const ordered = orderedExamQuestions(
    attempt.exam.questions,
    attempt.id,
    attempt.exam.randomize
  );

  const questions = ordered.map((question) => {
    const answer = answersByQuestion.get(question.id);
    return {
      id: question.id,
      text: question.text,
      correctOption: question.correctOption,
      selected: answer?.selectedOption ?? null,
      sectionId: question.sectionId ?? null,
      sectionName: question.section?.name ?? null,
      sectionDetails: question.section?.details ?? null,
      options: scrambleQuestionOptions(question, attempt.id).map((o) => ({
        display: o.letter,
        canonical: o.canonical,
        text: o.text,
      })),
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
