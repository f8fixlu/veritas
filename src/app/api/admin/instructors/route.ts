import { NextResponse } from "next/server";
import { hashPassword, requireApiAdmin, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return NextResponse.json(
      {
        error:
          "Provide a name, a valid email and a password of at least 6 characters.",
      },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: ROLES.INSTRUCTOR,
      sessionVersion: 1,
      emailVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: user.id });
}
