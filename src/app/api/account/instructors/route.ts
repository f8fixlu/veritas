import { NextResponse } from "next/server";
import { requireApiUser, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";

const IP_LIMIT = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const limit = rateLimit(
    `instructor-link:ip:${clientIp(req) ?? "unknown"}`,
    IP_LIMIT,
    IP_WINDOW_MS
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== ROLES.STUDENT) {
    return NextResponse.json(
      { error: "Only students can link instructors." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.instructorCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-character instructor code." },
      { status: 400 }
    );
  }

  const db = getDb();
  const instructor = await db.user.findUnique({
    where: { studentCode: code },
    select: { id: true, name: true, role: true },
  });
  if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
    return NextResponse.json(
      { error: "That instructor code was not found. Check it and try again." },
      { status: 404 }
    );
  }

  const existing = await db.instructorStudent.findUnique({
    where: {
      studentId_instructorId: {
        studentId: user.id,
        instructorId: instructor.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: `You are already linked to ${instructor.name}.` },
      { status: 409 }
    );
  }

  await db.instructorStudent.create({
    data: { studentId: user.id, instructorId: instructor.id },
  });

  return NextResponse.json({ ok: true, instructorName: instructor.name });
}
