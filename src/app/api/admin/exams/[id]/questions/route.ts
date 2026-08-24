import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
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

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: { _count: { select: { attempts: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (exam._count.attempts > 0) {
    return NextResponse.json(
      { error: "Students have already taken this exam; questions are locked." },
      { status: 409 }
    );
  }

  const maxOrder = await db.question.aggregate({
    where: { examId },
    _max: { order: true },
  });

  await db.question.create({
    data: {
      examId,
      order: (maxOrder._max.order ?? 0) + 1,
      text,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
    },
  });

  return NextResponse.json({ ok: true });
}
