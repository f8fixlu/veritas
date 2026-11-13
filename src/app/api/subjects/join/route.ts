import { NextResponse } from "next/server";
import { ROLES, requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveSchoolOption } from "@/lib/school-options-server";

/**
 * Student self-enrollment. A subject token enrolls the student and links them
 * to that subject's instructor in one transaction. Staff use the instructor
 * enrollment panel instead.
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
    include: {
      owner: { select: { id: true, name: true, role: true, school: true } },
      schoolOption: true,
    },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "No subject matches that enrollment token." },
      { status: 404 }
    );
  }

  const schoolName = subject.schoolOption?.name ?? subject.owner?.school ?? "";
  const schoolOption = await resolveSchoolOption(schoolName);
  if (!schoolOption) {
    return NextResponse.json(
      { error: "This subject has no active School / HEI linked to its enrollment token. Ask the instructor to update their profile." },
      { status: 409 },
    );
  }

  const { alreadyEnrolled } = await db.$transaction(async (tx) => {
    const existing = await tx.enrollment.findUnique({
      where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: { userId: user.id, subjectId: subject.id },
      });
    }
    if (!subject.schoolOptionId) {
      await tx.subject.update({
        where: { id: subject.id },
        data: { schoolOptionId: schoolOption.id },
      });
    }
    await tx.user.update({
      where: { id: user.id },
      data: { school: schoolOption.name },
    });
    if (subject.owner?.role === ROLES.INSTRUCTOR) {
      await tx.instructorStudent.upsert({
        where: {
          studentId_instructorId: {
            studentId: user.id,
            instructorId: subject.owner.id,
          },
        },
        create: {
          studentId: user.id,
          instructorId: subject.owner.id,
        },
        update: {},
      });
    }
    return { alreadyEnrolled: Boolean(existing) };
  });

  return NextResponse.json({
    ok: true,
    alreadyEnrolled,
    subjectId: subject.id,
    subjectName: subject.name,
    schoolName: schoolOption.name,
    ownerName: subject.owner?.name ?? null,
  });
}
