import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const questionId = Number((await ctx.params).id);
  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { exam: { include: { _count: { select: { attempts: true } } } } },
  });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (question.exam._count.attempts > 0) {
    return NextResponse.json(
      { error: "Students have already taken this exam; questions are locked." },
      { status: 409 }
    );
  }

  await db.question.delete({ where: { id: questionId } });
  return NextResponse.json({ ok: true });
}
