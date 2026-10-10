import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isVirtualCameraLabel } from "@/lib/camera";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Marks the attempt as camera-enabled once the webcam stream goes live, so an
 * admin watching the live report sees "camera on" even before the first
 * snapshot is uploaded. Also records the device label and flags known virtual /
 * software cameras (OBS, ManyCam, …) for the instructor report.
 */
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

  const body = await req.json().catch(() => null);
  const label =
    typeof body?.label === "string" ? body.label.trim().slice(0, 120) : "";
  const virtualCamera = isVirtualCameraLabel(label);

  await db.attempt.update({
    where: { id: attemptId },
    data: {
      cameraEnabled: true,
      ...(label ? { cameraLabel: label, virtualCamera } : {}),
    },
  });

  return NextResponse.json({ ok: true, virtualCamera });
}
