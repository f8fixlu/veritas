import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjectId = Number((await ctx.params).id);
  if (!Number.isInteger(subjectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid student" }, { status: 400 });
  }

  const db = getDb();
  const student = await db.user.findUnique({ where: { id: userId } });
  if (!student || student.role !== "STUDENT") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const existing = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId, subjectId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Student is already enrolled." }, { status: 409 });
  }

  await db.enrollment.create({ data: { userId, subjectId } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjectId = Number((await ctx.params).id);
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isInteger(subjectId) || !Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await getDb().enrollment.deleteMany({ where: { userId, subjectId } });
  return NextResponse.json({ ok: true });
}
