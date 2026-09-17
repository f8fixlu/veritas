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
    select: {
      cameraEnabled: true,
      snapshotCount: true,
      user: { select: { name: true, email: true } },
      exam: { select: { title: true } },
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const snapshots = await db.attemptSnapshot.findMany({
    where: { attemptId },
    orderBy: { capturedAt: "asc" },
    select: { id: true, capturedAt: true },
  });

  return NextResponse.json({
    studentName: attempt.user.name,
    studentEmail: attempt.user.email,
    examTitle: attempt.exam.title,
    cameraEnabled: attempt.cameraEnabled,
    snapshotCount: attempt.snapshotCount,
    snapshots: snapshots.map((s) => ({
      id: s.id,
      capturedAtISO: s.capturedAt.toISOString(),
      url: `/api/admin/snapshots/${s.id}`,
    })),
  });
}