import { NextResponse } from "next/server";
import { requireApiAdmin, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Links a student to an instructor (admin only). Students can also add
 * instructor links themselves with the instructor's code.
 */
export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const instructorId = Number(body?.instructorId);
  if (!Number.isInteger(instructorId) || instructorId < 1) {
    return NextResponse.json({ error: "Invalid instructor" }, { status: 400 });
  }

  const db = getDb();
  const student = await db.user.findUnique({ where: { id } });
  if (!student || student.role !== ROLES.STUDENT) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const instructor = await db.user.findUnique({ where: { id: instructorId } });
  if (!instructor || instructor.role !== ROLES.INSTRUCTOR) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }

  const existing = await db.instructorStudent.findUnique({
    where: { studentId_instructorId: { studentId: id, instructorId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This student is already linked to that instructor." },
      { status: 409 }
    );
  }

  await db.instructorStudent.create({ data: { studentId: id, instructorId } });
  return NextResponse.json({ ok: true });
}
