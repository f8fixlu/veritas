import { NextResponse } from "next/server";
import { createSessionToken, hashPassword, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const gender = String(body?.gender ?? "").trim().toUpperCase();
  const password = String(body?.password ?? "");

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return NextResponse.json(
      { error: "Provide a name, a valid email and a password of at least 6 characters." },
      { status: 400 }
    );
  }
  if (gender !== "MALE" && gender !== "FEMALE") {
    return NextResponse.json(
      { error: "Select a gender." },
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
      role: "STUDENT",
      gender,
    },
  });

  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
