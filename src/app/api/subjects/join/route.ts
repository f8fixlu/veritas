import { NextResponse } from "next/server";
import { ROLES, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Student self-enrollment. The student enters the 6-char code their instructor
 * gave them; this looks the subject up by its globally-unique token and enrolls
 * them. Staff are rejected — the instructor enrollment panel is how they work
 * with students.
 */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== ROLES.STUDENT) {
    return NextResponse.json(
      { error: "Only students can join a subject." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^[A-Z0-9]{6}$/.test(token)) {
    return NextResponse.json({ error: "Invalid enrollment token." }, { status: 400 });
  }

  const db = getDb();
  const subject = await db.subject.findUnique({
    where: { joinToken: token },
    include: { owner: { select: { name: true } } },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "No subject matches that enrollment token." },
      { status: 404 }
    );
  }

  const existing = await db.enrollment.findUnique({
    where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You are already enrolled in this subject." },
      { status: 409 }
    );
  }

  await db.enrollment.create({ data: { userId: user.id, subjectId: subject.id } });

  return NextResponse.json({
    ok: true,
    subjectId: subject.id,
    subjectName: subject.name,
    ownerName: subject.owner?.name ?? null,
  });
}