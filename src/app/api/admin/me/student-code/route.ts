import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent } from "@/lib/scope";
import { generateStudentCode } from "@/lib/tokens";

/**
 * Regenerates the caller's instructor code. Students use it at registration or
 * on their Subjects page to link an account. Existing links are unaffected.
 */
export async function POST() {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only instructors have a student code." },
      { status: 403 }
    );
  }

  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const studentCode = generateStudentCode();
      await db.user.update({
        where: { id: user.id },
        data: { studentCode },
      });
      return NextResponse.json({ ok: true, studentCode });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique student code. Try again." },
    { status: 500 }
  );
}
