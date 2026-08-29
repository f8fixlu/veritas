import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const exam = await db.exam.findUnique({
    where: { id: examId },
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
  });
}
