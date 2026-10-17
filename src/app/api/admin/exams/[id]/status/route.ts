import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { canManageContent, ownedExamWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns an exam can view its live status." },
      { status: 403 }
    );
  }

  const db = getDb();
  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const exam = await db.exam.findFirst({
    where: { id: examId, ...ownedExamWhere(user) },
    select: { id: true, subjectId: true, durationMinutes: true },
  });
  if (!exam) {
    return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  }

  const [enrolledUsers, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: { subjectId: exam.subjectId },
      select: { userId: true },
    }),
    db.attempt.findMany({ where: { examId } }),
  ]);

  const resolved = await finalizeManyIfExpired(
    attempts.map((attempt) => ({
      attempt,
      durationMinutes: exam.durationMinutes,
    }))
  );

  const userIds = new Set(enrolledUsers.map((e) => e.userId));

  // Per-attempt live data for the roster's status/flag cells. Every live row on
  // the report (and admin overview) page subscribes to THIS one request rather
  // than polling a per-attempt endpoint once per row — a full class of live
  // rows used to cost one request each every 5s.
  const liveAttemptIds = resolved
    .filter((attempt) => userIds.has(attempt.userId) && !attempt.submittedAt)
    .map((attempt) => attempt.id);
  const answeredByAttempt = new Map<number, number>();
  if (liveAttemptIds.length > 0) {
    const answeredGroups = await db.answer.groupBy({
      by: ["attemptId"],
      where: {
        attemptId: { in: liveAttemptIds },
        selectedOption: { not: null },
      },
      _count: { _all: true },
    });
    for (const group of answeredGroups) {
      if (group.attemptId !== null) {
        answeredByAttempt.set(group.attemptId, group._count._all);
      }
    }
  }

  const attemptSummaries: Record<
    string,
    {
      answered: number;
      submittedAtISO: string | null;
      focusLosses: number;
      totalFocusLossMs: number;
      maxBlurMs: number;
    }
  > = {};
  for (const attempt of resolved) {
    if (!userIds.has(attempt.userId)) continue;
    attemptSummaries[String(attempt.id)] = {
      answered: answeredByAttempt.get(attempt.id) ?? 0,
      // Kept for submitted attempts too, so a live row can notice it finished
      // and stop polling without another endpoint.
      submittedAtISO: attempt.submittedAt?.toISOString() ?? null,
      focusLosses: attempt.focusLosses ?? 0,
      totalFocusLossMs: attempt.totalFocusLossMs ?? 0,
      maxBlurMs: attempt.maxBlurMs ?? 0,
    };
  }

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  const statusByUser = new Map<number, "completed" | "inprogress" | "notstarted">();

  for (const id of userIds) {
    statusByUser.set(id, "notstarted");
  }

  for (const attempt of resolved) {
    if (!userIds.has(attempt.userId)) continue;
    statusByUser.set(attempt.userId, attempt.submittedAt ? "completed" : "inprogress");
    if (attempt.submittedAt) completed += 1;
    else inProgress += 1;
  }
  for (const id of userIds) {
    if (statusByUser.get(id) === "notstarted") notStarted += 1;
  }

  return NextResponse.json({
    enrolled: userIds.size,
    completed,
    inProgress,
    notStarted,
    students: Array.from(statusByUser.entries()).map(([userId, status]) => ({
      userId,
      status,
    })),
    attempts: attemptSummaries,
  });
}
