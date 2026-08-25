import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
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

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const optionA = String(body?.optionA ?? "").trim();
  const optionB = String(body?.optionB ?? "").trim();
  const optionC = String(body?.optionC ?? "").trim();
  const optionD = String(body?.optionD ?? "").trim();
  const correctOption = String(body?.correctOption ?? "").toUpperCase();

  if (!text || !optionA || !optionB || !optionC || !optionD) {
    return NextResponse.json(
      { error: "Question text and all four options are required." },
      { status: 400 }
    );
  }
  if (!/^[ABCD]$/.test(correctOption)) {
    return NextResponse.json({ error: "Mark which option is correct." }, { status: 400 });
  }

  // Optional new section; must belong to the same exam.
  let sectionId: number | null = null;
  const rawSectionId = body?.sectionId;
  if (rawSectionId !== undefined && rawSectionId !== null && rawSectionId !== "") {
    const parsedSectionId = Number(rawSectionId);
    const section = await db.examSection.findFirst({
      where: { id: parsedSectionId, examId: question.examId },
      select: { id: true },
    });
    if (!section) {
      return NextResponse.json(
        { error: "The selected section does not belong to this exam." },
        { status: 400 }
      );
    }
    sectionId = section.id;
  }

  await db.question.update({
    where: { id: questionId },
    data: {
      text,
      sectionId,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
    },
  });

  return NextResponse.json({ ok: true });
}

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
