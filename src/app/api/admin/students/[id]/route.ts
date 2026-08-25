import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (user.role !== "STUDENT") {
    return NextResponse.json({ error: "Only student accounts can be deleted." }, { status: 400 });
  }

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { userId: id } } }),
    db.attempt.deleteMany({ where: { userId: id } }),
    db.enrollment.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
