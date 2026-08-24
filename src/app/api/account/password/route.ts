import { NextResponse } from "next/server";
import { hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const db = getDb();
  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record || !verifyPassword(currentPassword, record.passwordHash)) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
