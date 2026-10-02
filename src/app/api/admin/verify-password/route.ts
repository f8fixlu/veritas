import { NextResponse } from "next/server";
import { requireApiStaff, verifyUserPassword } from "@/lib/auth";

/**
 * Checks whether the given password matches the authenticated (staff) user's
 * own account. Used by the delete flow to enable the confirm button only once
 * the password is correct. Always answers with a boolean (200) so the client
 * can gate the button; the destructive endpoints re-verify before acting.
 */
export async function POST(req: Request) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json({ valid: false });
  }

  const valid = await verifyUserPassword(user.id, password);
  return NextResponse.json({ valid });
}