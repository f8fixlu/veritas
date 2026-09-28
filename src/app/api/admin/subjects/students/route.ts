import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { canManageContent, searchStudents } from "@/lib/scope";

/**
 * Looks up students by name or email for the enroll box on a subject page.
 * Subject pages only list students already enrolled in the caller's subjects,
 * so this is the only way a student outside that set can be found. Returns at
 * most 10 matches — never the global roster.
 */
export async function GET(req: Request) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only instructors can look up students." },
      { status: 403 }
    );
  }

  const query = new URL(req.url).searchParams.get("query") ?? "";
  const exclude = (new URL(req.url).searchParams.get("exclude") ?? "")
    .split(",")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);

  const students = await searchStudents(query, exclude);
  return NextResponse.json({ students });
}
