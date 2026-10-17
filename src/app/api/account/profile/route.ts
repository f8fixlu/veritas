import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { composeName } from "@/lib/format";

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

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 }
    );
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
    school: school || null,
    designation: designation || null,
    course: course || null,
    year: year || null,
    schoolYear: schoolYear || null,
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
