import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent, ownedExamWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only instructors can copy questions between their own exams." },
      { status: 403 }
    );
  }

  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const sourceExamId = Number(body?.sourceExamId);
  const replace = Boolean(body?.replace);

  const db = getDb();
  const exam = await db.exam.findFirst({
    where: { id: examId, ...ownedExamWhere(user) },
    include: { _count: { select: { attempts: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (exam._count.attempts > 0) {
    return NextResponse.json(
      { error: "Students have already taken this exam, so its questions can no longer be changed." },
      { status: 409 }
    );
  }
  if (!Number.isInteger(sourceExamId) || sourceExamId === examId) {
    return NextResponse.json(
      { error: "Pick another exam to copy questions from." },
      { status: 400 }
    );
  }

  // Optional target section for every copied question.
  let sectionId: number | null = null;
  const rawSectionId = body?.sectionId;
  if (rawSectionId !== undefined && rawSectionId !== null && rawSectionId !== "") {
    const parsedSectionId = Number(rawSectionId);
    const section = await db.examSection.findFirst({
      where: { id: parsedSectionId, examId },
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

  // The source exam is scoped too: questions carry the answer key, so copying
  // from another instructor's exam would leak it.
  const source = await db.exam.findFirst({
    where: { id: sourceExamId, ...ownedExamWhere(user) },
    include: {
      _count: { select: { questions: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Source exam not found." }, { status: 404 });
  }
  if (source._count.questions === 0) {
    return NextResponse.json(
      { error: "The source exam has no questions to copy." },
      { status: 400 }
    );
  }

  let startOrder = 1;
  const operations = [];
  if (replace) {
    operations.push(db.question.deleteMany({ where: { examId } }));
  } else {
    const maxOrder = await db.question.aggregate({
      where: { examId },
      _max: { order: true },
    });
    startOrder = (maxOrder._max.order ?? 0) + 1;
  }

  source.questions.forEach((q, index) => {
    operations.push(
      db.question.create({
        data: {
          examId,
          sectionId,
          order: startOrder + index,
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
        },
      })
    );
  });

  await db.$transaction(operations);

  return NextResponse.json({
    ok: true,
    copied: source.questions.length,
    replaced: replace,
  });
}
