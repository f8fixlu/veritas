import { NextResponse } from "next/server";
import { requireApiStaff, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent, ownedSubjectWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

const PAGE_SIZE = 10;

/**
 * Resolves the subject in the URL to an id the caller owns, or returns the
 * error response to send back. Admins and other instructors get a 404 so ids
 * don't leak existence.
 */
async function resolveOwnedSubject(
  raw: string,
  user: SessionUser
): Promise<{ subjectId: number } | { response: NextResponse }> {
  const subjectId = Number(raw);
  if (!Number.isInteger(subjectId) || subjectId < 1) {
    return {
      response: NextResponse.json({ error: "Invalid id" }, { status: 400 }),
    };
  }
  const subject = await getDb().subject.findFirst({
    where: { id: subjectId, ...ownedSubjectWhere(user) },
    select: { id: true },
  });
  if (!subject) {
    return { response: NextResponse.json({ error: "Subject not found" }, { status: 404 }) };
  }
  return { subjectId };
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns a subject can view enrollments." },
      { status: 403 }
    );
  }

  const owned = await resolveOwnedSubject((await ctx.params).id, user);
  if ("response" in owned) return owned.response;
  const subjectId = owned.subjectId;

  const rawPage = Number(new URL(req.url).searchParams.get("page") ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const db = getDb();
  const [total, rows] = await Promise.all([
    db.enrollment.count({ where: { subjectId } }),
    db.enrollment.findMany({
      where: { subjectId },
      orderBy: { user: { name: "asc" } },
      include: { user: { select: { id: true, name: true, email: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    students: rows.map((row) => row.user),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns a subject can enroll students." },
      { status: 403 }
    );
  }

  const owned = await resolveOwnedSubject((await ctx.params).id, user);
  if ("response" in owned) return owned.response;
  const subjectId = owned.subjectId;

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
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns a subject can unenroll students." },
      { status: 403 }
    );
  }

  const owned = await resolveOwnedSubject((await ctx.params).id, user);
  if ("response" in owned) return owned.response;

  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await getDb().enrollment.deleteMany({
    where: { userId, subjectId: owned.subjectId },
  });
  return NextResponse.json({ ok: true });
}
