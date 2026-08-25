import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = parseId((await ctx.params).id);
  if (!examId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.sections)) {
    return NextResponse.json(
      { error: "sections must be an array." },
      { status: 400 }
    );
  }

  const sections: {
    name: string;
    details: string | null;
    pointsPerQuestion: number;
  }[] = [];
  for (const raw of body.sections) {
    const name = String(raw?.name ?? "").trim();
    const details = String(raw?.details ?? "").trim() || null;
    const ppq = Number(raw?.pointsPerQuestion ?? 1);
    if (!name) continue;
    if (!Number.isInteger(ppq) || ppq < 1 || ppq > 100) {
      return NextResponse.json(
        { error: "Section points must be whole numbers between 1 and 100." },
        { status: 400 }
      );
    }
    sections.push({ name, details, pointsPerQuestion: ppq });
  }

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true },
  });
  if (!exam) {
    return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  }

  // Replacing sections detaches their questions; they fall back to the
  // exam-wide default points. Match remaining questions to re-created
  // sections by name so editing one section doesn't unassign its questions.
  const existing = await db.examSection.findMany({
    where: { examId },
    select: { id: true, name: true },
  });
  const oldByName = new Map(existing.map((s) => [s.name.toLowerCase(), s.id]));
  const questionIdsByOldSection = new Map<number, number[]>();
  for (const section of existing) {
    const qs = await db.question.findMany({
      where: { sectionId: section.id },
      select: { id: true },
    });
    questionIdsByOldSection.set(
      section.id,
      qs.map((q) => q.id)
    );
  }

  await db.$transaction(async (tx) => {
    await tx.examSection.deleteMany({ where: { examId } });
    for (const [index, section] of sections.entries()) {
      const created = await tx.examSection.create({
        data: {
          examId,
          name: section.name,
          details: section.details,
          pointsPerQuestion: section.pointsPerQuestion,
          order: index,
        },
      });
      const oldId =
        oldByName.get(section.name.toLowerCase()) ?? undefined;
      if (oldId !== undefined) {
        const ids = questionIdsByOldSection.get(oldId) ?? [];
        if (ids.length > 0) {
          await tx.question.updateMany({
            where: { id: { in: ids } },
            data: { sectionId: created.id },
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
