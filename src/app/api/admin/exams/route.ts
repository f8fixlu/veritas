import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const subjectId = Number(body?.subjectId);
  const description = String(body?.description ?? "").trim();
  const durationMinutes = Number(body?.durationMinutes ?? 30);
  const showResult = Boolean(body?.showResult);
  const randomize = body?.randomize === undefined ? true : Boolean(body.randomize);

  if (!title || !Number.isInteger(subjectId)) {
    return NextResponse.json(
      { error: "Title and subject are required." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
    return NextResponse.json(
      { error: "Duration must be between 1 and 600 minutes." },
      { status: 400 }
    );
  }

  const db = getDb();
  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found." }, { status: 404 });
  }

  try {
    const exam = await db.exam.create({
      data: {
        title,
        subjectId,
        description: description || null,
        durationMinutes,
        showResult,
        randomize,
      },
    });
    return NextResponse.json({ ok: true, id: exam.id });
  } catch (err) {
    console.error("[exam:create]", err);
    return NextResponse.json(
      { error: "Could not create the exam." },
      { status: 500 }
    );
  }
}
