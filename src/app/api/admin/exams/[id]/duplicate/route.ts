import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function nextCopyTitle(base: string, existingTitles: Set<string>): string {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base} (copy)` : `${base} (copy ${n})`;
    if (!existingTitles.has(candidate)) return candidate;
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      sections: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const existingTitles = new Set(
    (
      await db.exam.findMany({
        where: { subjectId: exam.subjectId },
        select: { title: true },
      })
    ).map((e) => e.title)
  );
  const newTitle = nextCopyTitle(exam.title, existingTitles);

  let newId = 0;
  await db.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        title: newTitle,
        subjectId: exam.subjectId,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        pointsPerQuestion: exam.pointsPerQuestion,
        published: false,
        showResult: exam.showResult,
        randomize: exam.randomize,
      },
    });
    newId = created.id;

    const sectionIdMap = new Map<number, number>();
    for (const section of exam.sections) {
      const createdSection = await tx.examSection.create({
        data: {
          examId: created.id,
          name: section.name,
          details: section.details,
          pointsPerQuestion: section.pointsPerQuestion,
          order: section.order,
        },
      });
      sectionIdMap.set(section.id, createdSection.id);
    }

    for (const question of exam.questions) {
      await tx.question.create({
        data: {
          examId: created.id,
          sectionId: question.sectionId
            ? (sectionIdMap.get(question.sectionId) ?? null)
            : null,
          text: question.text,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctOption: question.correctOption,
          order: question.order,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    id: newId,
    title: newTitle,
    sections: exam.sections.length,
    questions: exam.questions.length,
  });
}
