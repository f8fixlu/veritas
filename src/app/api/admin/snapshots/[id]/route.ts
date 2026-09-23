import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSnapshotFile, snapshotPath } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireApiStaff();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const snapshot = await db.attemptSnapshot.findUnique({
    where: { id },
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