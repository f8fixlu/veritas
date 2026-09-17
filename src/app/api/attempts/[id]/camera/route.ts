import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Marks the attempt as camera-enabled once the webcam stream goes live, so an
 * admin watching the live report sees "camera on" even before the first
 * snapshot is uploaded.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, submittedAt: true },
  });
  if (!attempt || attempt.userId !== user.id) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }
  if (attempt.submittedAt) {
    return NextResponse.json(
      { error: "This attempt was already submitted." },
      { status: 409 }
    );
  }

  await db.attempt.update({
    where: { id: attemptId },
    data: { cameraEnabled: true },
  });

  return NextResponse.json({ ok: true });
}