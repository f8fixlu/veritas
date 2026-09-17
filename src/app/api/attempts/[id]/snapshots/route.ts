import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  SNAPSHOT_MAX_BATCH,
  SNAPSHOT_MAX_BYTES,
  SNAPSHOT_MIN_GAP_MS,
  saveSnapshot,
} from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attemptId = Number((await ctx.params).id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: { select: { requireCamera: true } } },
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
  if (attempt.exam.requireCamera && !attempt.cameraEnabled) {
    return NextResponse.json(
      { error: "Camera is not active for this attempt." },
      { status: 400 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected form data." }, { status: 400 });
  }

  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File)
    .filter((f) => /^image\/(jpe?g)$/i.test((f as File).type));
  if (files.length === 0) {
    return NextResponse.json({ error: "No JPEG snapshots sent." }, { status: 400 });
  }
  if (files.length > SNAPSHOT_MAX_BATCH) {
    return NextResponse.json(
      { error: `Too many snapshots in one request (max ${SNAPSHOT_MAX_BATCH}).` },
      { status: 400 }
    );
  }

  const lastSnapshot = await db.attemptSnapshot.findFirst({
    where: { attemptId },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  const lastAt = lastSnapshot?.capturedAt.getTime() ?? 0;
  const now = Date.now();

  const saved: { path: string; capturedAt: Date }[] = [];
  for (let i = 0; i < files.length; i++) {
    // Clamp the client timestamp to a sensible window: not before the last
    // saved snapshot, not in the future, and at least a small gap apart so a
    // flood of backdated frames can't be dumped in one go.
    const rawAt = Number(files[i].name.replace(/\.(jpe?g)$/i, "") || "0");
    const capturedAt = new Date(
      Math.min(now, Math.max(lastAt + SNAPSHOT_MIN_GAP_MS, rawAt))
    );
    if (files[i].size > SNAPSHOT_MAX_BYTES) continue;

    const buffer = Buffer.from(await files[i].arrayBuffer());
    if (buffer.length === 0 || buffer.length > SNAPSHOT_MAX_BYTES) continue;
    if (buffer.readUInt16BE(0) !== 0xffd8) continue;

    const path = await saveSnapshot(attemptId, buffer, capturedAt);
    saved.push({ path, capturedAt });
  }

  if (saved.length === 0) {
    return NextResponse.json(
      { error: "No usable snapshots were received." },
      { status: 400 }
    );
  }

  await db.$transaction([
    db.attemptSnapshot.createMany({
      data: saved.map((s) => ({ attemptId, ...s })),
    }),
    db.attempt.update({
      where: { id: attemptId },
      data: {
        cameraEnabled: true,
        snapshotCount: { increment: saved.length },
      },
    }),
  ]);

  const { snapshotCount } = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { snapshotCount: true },
  });

  return NextResponse.json({ ok: true, saved: saved.length, snapshotCount });
}