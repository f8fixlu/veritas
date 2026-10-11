import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: { select: { requireScreenCapture: true } } },
  });
  if (!attempt || attempt.userId !== user.id) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.submittedAt) return NextResponse.json({ error: "This attempt was already submitted." }, { status: 409 });
  if (!attempt.exam.requireScreenCapture) return NextResponse.json({ error: "Screen sharing is not required for this attempt." }, { status: 400 });
  // What the student actually shared (browser-reported, best-effort). Only
  // accepted values are persisted; anything else is stored as null.
  const body = await req.json().catch(() => null);
  const rawSurface = body?.surface;
  const screenSurface =
    rawSurface === "monitor" || rawSurface === "window" || rawSurface === "browser"
      ? rawSurface
      : null;
  await db.attempt.update({ where: { id: attemptId }, data: { screenEnabled: true, screenSurface } });
  return NextResponse.json({ ok: true });
}
