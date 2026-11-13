import { NextResponse } from "next/server";
import { requireApiAdmin, verifyUserPassword, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteAttemptSnapshots } from "@/lib/snapshots";
import { composeName } from "@/lib/format";
import { resolveSchoolOption } from "@/lib/school-options-server";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const instructor = await getDb().user.findFirst({
    where: { id, role: ROLES.INSTRUCTOR },
    select: {
      id: true,
      name: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      avatarData: true,
      dateOfBirth: true,
      school: true,
      designation: true,
      studentCode: true,
      createdAt: true,
    },
  });
  if (!instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...instructor,
    firstName: instructor.firstName ?? "",
    middleName: instructor.middleName ?? "",
    lastName: instructor.lastName ?? "",
    dateOfBirth: instructor.dateOfBirth?.toISOString() ?? null,
    school: instructor.school ?? "",
    designation: instructor.designation ?? "",
    createdAt: instructor.createdAt.toISOString(),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const firstName = String(body?.firstName ?? "").trim();
  const middleName = String(body?.middleName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const school = String(body?.school ?? "").trim();
  const designation = String(body?.designation ?? "").trim();
  const dobRaw = String(body?.dateOfBirth ?? "").trim();

  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a first name, last name, and valid email address." },
      { status: 400 }
    );
  }
  if (!school) {
    return NextResponse.json({ error: "Select a school / HEI." }, { status: 400 });
  }
  const schoolOption = await resolveSchoolOption(school);
  if (!schoolOption) {
    return NextResponse.json({ error: "Select a school / HEI from the list." }, { status: 400 });
  }

  let dateOfBirth: Date | null = null;
  if (dobRaw) {
    const parsed = new Date(dobRaw);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Enter a valid birth date in the past." },
        { status: 400 }
      );
    }
    dateOfBirth = parsed;
  }

  const db = getDb();
  const instructor = await db.user.findFirst({
    where: { id, role: ROLES.INSTRUCTOR },
    select: { id: true },
  });
  if (!instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  const existingEmail = await db.user.findFirst({
    where: { email, id: { not: id } },
    select: { id: true },
  });
  if (existingEmail) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  try {
    const updated = await db.user.update({
      where: { id },
      data: {
        name: composeName(firstName, middleName, lastName),
        firstName,
        middleName: middleName || null,
        lastName,
        email,
        dateOfBirth,
        school: schoolOption.name,
        designation: designation || null,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        avatarData: true,
        dateOfBirth: true,
        school: true,
        designation: true,
        studentCode: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      ...updated,
      firstName: updated.firstName ?? "",
      middleName: updated.middleName ?? "",
      lastName: updated.lastName ?? "",
      dateOfBirth: updated.dateOfBirth?.toISOString() ?? null,
      school: updated.school ?? "",
      designation: updated.designation ?? "",
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json(
      { error: "Enter your password to confirm." },
      { status: 400 }
    );
  }
  if (!(await verifyUserPassword(admin.id, password))) {
    return NextResponse.json(
      { error: "Your password was incorrect." },
      { status: 401 }
    );
  }

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb();
  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  if (user.role !== ROLES.INSTRUCTOR) {
    return NextResponse.json(
      { error: "Only instructor accounts can be deleted here." },
      { status: 400 }
    );
  }

  // Subjects (and the exams, questions and results under them) belong to the
  // instructor, so removal has to be an explicit decision by the admin rather
  // than silently stranding or destroying that content.
  const ownedSubjects = await db.subject.findMany({
    where: { ownerId: id },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  if (ownedSubjects.length > 0) {
    return NextResponse.json(
      {
        error:
          "This instructor still owns subjects. Delete those subjects first " +
          `(or hand their content over) before removing the account: ` +
          ownedSubjects.map((s) => s.name).join(", ") +
          ".",
        subjects: ownedSubjects.map((s) => s.name),
      },
      { status: 409 }
    );
  }

  const attemptIds = (
    await db.attempt.findMany({
      where: { userId: id },
      select: { id: true },
    })
  ).map((a) => a.id);

  await db.$transaction([
    db.user.updateMany({ where: { instructorId: id }, data: { instructorId: null } }),
    db.answer.deleteMany({ where: { attempt: { userId: id } } }),
    db.attempt.deleteMany({ where: { userId: id } }),
    db.enrollment.deleteMany({ where: { userId: id } }),
    db.user.delete({ where: { id } }),
  ]);

  for (const attemptId of attemptIds) {
    await deleteAttemptSnapshots(attemptId);
  }

  return NextResponse.json({ ok: true });
}
