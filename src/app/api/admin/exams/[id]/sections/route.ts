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
    id: number | null;
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
    const rawId = Number(raw?.id);
    const id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
    sections.push({ id, name, details, pointsPerQuestion: ppq });
  }

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true },
  });
  if (!exam) {
    return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  }

  // Sections are updated in place by id, so renaming or editing one keeps its
  // questions attached. Sections omitted from the payload are deleted and
  // their questions fall back to the exam-wide default points (SetNull).
  const existing = await db.examSection.findMany({
    where: { examId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));

  await db.$transaction(async (tx) => {
    const keepIds = sections
      .map((s) => s.id)
      .filter((id): id is number => id !== null && existingIds.has(id));
    await tx.examSection.deleteMany({
      where: { examId, id: { notIn: keepIds } },
    });
    for (const [index, section] of sections.entries()) {
      const data = {
        name: section.name,
        details: section.details,
        pointsPerQuestion: section.pointsPerQuestion,
        order: index,
      };
      if (section.id !== null && existingIds.has(section.id)) {
        await tx.examSection.update({ where: { id: section.id }, data });
      } else {
        await tx.examSection.create({ data: { examId, ...data } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
