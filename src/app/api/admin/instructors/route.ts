import { NextResponse } from "next/server";
import { hashPassword, requireApiAdmin, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { generateStudentCode } from "@/lib/tokens";

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error:
          `Provide a name, a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
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

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const studentCode = generateStudentCode();
      const user = await db.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: ROLES.INSTRUCTOR,
          sessionVersion: 1,
          emailVerifiedAt: new Date(),
          studentCode,
        },
        select: { id: true, studentCode: true },
      });
      return NextResponse.json({ ok: true, id: user.id, studentCode: user.studentCode });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique student code. Try again." },
    { status: 500 }
  );
}
