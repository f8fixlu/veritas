import { NextResponse } from "next/server";
import {
  createSessionToken,
  createVerificationToken,
  hashPassword,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";

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

  // When email sending is not configured (e.g. local development), verify
  // immediately so the app stays usable. In production with RESEND_API_KEY set,
  // the account starts unverified until the link is clicked.
  const mailConfigured = Boolean(process.env.RESEND_API_KEY);
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: "STUDENT",
      gender,
      sessionVersion: 1,
      emailVerifiedAt: mailConfigured ? null : new Date(),
    },
  });

  if (mailConfigured) {
    const token = await createVerificationToken(user.id);
    const sent = await sendVerificationEmail({
      email,
      name,
      verificationToken: token,
    });
    if (!sent) {
      return NextResponse.json(
        { error: "We couldn't send the verification email. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, needVerification: true });
  }

  const sessionToken = await createSessionToken(user.id, user.sessionVersion);
  const res = NextResponse.json({ ok: true, needVerification: false });
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions);
  return res;
}
