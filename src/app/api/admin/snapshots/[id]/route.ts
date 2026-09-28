import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent, ownedSnapshotWhere } from "@/lib/scope";
import { isSnapshotFile, snapshotPath } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns this exam can view its webcam snapshots." },
      { status: 403 }
    );
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  // Scoped through attempt -> exam -> subject: a snapshot id on its own must
  // never be enough to read a student's webcam image.
  const snapshot = await db.attemptSnapshot.findFirst({
    where: { id, ...ownedSnapshotWhere(user) },
    select: { path: true },
  });
  if (!snapshot || !isSnapshotFile(snapshot.path)) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  try {
    const buffer = await fs.promises.readFile(snapshotPath(snapshot.path));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Snapshot file is missing." }, { status: 404 });
  }
}