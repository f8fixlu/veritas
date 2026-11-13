import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { composeName } from "@/lib/format";
import { resolveSchoolOption } from "@/lib/school-options-server";
import { isGraduateLevel, STUDENT_EDUCATION_LEVELS } from "@/lib/student-education";

export async function GET() {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getDb().user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      dateOfBirth: true,
      school: true,
      avatarData: true,
      designation: true,
      course: true,
      year: true,
      schoolYear: true,
      educationLevel: true,
      secondarySchool: true,
      studentCode: true,
    },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    name: record.name,
    email: record.email,
    firstName: record.firstName ?? "",
    middleName: record.middleName ?? "",
    lastName: record.lastName ?? "",
    dateOfBirth: record.dateOfBirth?.toISOString() ?? null,
    school: record.school ?? "",
    avatarData: record.avatarData ?? null,
    designation: record.designation ?? "",
    course: record.course ?? "",
    year: record.year ?? "",
    schoolYear: record.schoolYear ?? "",
    educationLevel: record.educationLevel ?? "",
    secondarySchool: record.secondarySchool ?? "",
    studentCode: record.studentCode ?? null,
  });
}

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const firstName = String(body?.firstName ?? "").trim();
  const middleName = String(body?.middleName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const school = String(body?.school ?? "").trim();
  const dobRaw = String(body?.dateOfBirth ?? "").trim();
  const avatarData = body?.avatarData; // base64 data URL or null to remove
  const designation = String(body?.designation ?? "").trim();
  const course = String(body?.course ?? "").trim();
  const year = String(body?.year ?? "").trim();
  const schoolYear = String(body?.schoolYear ?? "").trim();
  const educationLevel = String(body?.educationLevel ?? "").trim().toUpperCase();
  const secondarySchool = String(body?.secondarySchool ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
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
  if (user.role === "STUDENT") {
    const allowedLevels = STUDENT_EDUCATION_LEVELS.map((level) => level.value);
    if (educationLevel && !allowedLevels.includes(educationLevel as typeof allowedLevels[number])) {
      return NextResponse.json({ error: "Select a valid education level." }, { status: 400 });
    }
    if (isGraduateLevel(educationLevel) && !secondarySchool) {
      return NextResponse.json({ error: "Enter your secondary school for Masteral or Doctorate study." }, { status: 400 });
    }
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

  const name = composeName(firstName, middleName, lastName);

  const updateData: Record<string, unknown> = {
    name,
    firstName,
    middleName: middleName || null,
    lastName,
    dateOfBirth,
    school: schoolOption.name,
    designation: designation || null,
    course: course || null,
    year: year || null,
    schoolYear: schoolYear || null,
    educationLevel: user.role === "STUDENT" ? educationLevel || null : null,
    secondarySchool: user.role === "STUDENT" && isGraduateLevel(educationLevel)
      ? secondarySchool
      : null,
  };
  if (avatarData !== undefined) {
    updateData.avatarData = avatarData || null;
  }

  await getDb().user.update({
    where: { id: user.id },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
