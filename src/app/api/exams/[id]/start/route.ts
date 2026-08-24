import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attemptEndsAt, finalizeIfExpired } from "@/lib/exam";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { questions: true } },
    },
  });
  if (!exam || !exam.published) {
    return NextResponse.json({ error: "This exam is not available." }, { status: 404 });
  }
  if (exam._count.questions === 0) {
    return NextResponse.json(
      { error: "This exam has no questions yet." },
      { status: 409 }
    );
  }

  const enrolled = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId: exam.subjectId } },
  });
  if (!enrolled && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You are not enrolled in this subject." },
      { status: 403 }
    );
  }

  let attempt = await db.attempt.findUnique({
    where: { examId_userId: { examId, userId: user.id } },
  });

  if (!attempt) {
    attempt = await db.attempt.create({ data: { examId, userId: user.id } });
  } else {
    const finalized = await finalizeIfExpired(attempt, exam.durationMinutes);
    if (finalized.submittedAt) {
      return NextResponse.json(
        { ok: true, ended: true, attemptId: finalized.id },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    ended: false,
    attemptId: attempt.id,
    endsAt: attemptEndsAt(attempt, exam.durationMinutes).toISOString(),
  });
}
