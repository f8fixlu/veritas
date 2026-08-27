import { NextResponse } from "next/server";
import {
  createVerificationToken,
  getSessionUser,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";

const MIN_RESEND_MS = 60_000;

export async function POST(req: Request) {
  const db = getDb();
  const session = await getSessionUser();

  let email: string | null = null;
  let name: string | null = null;
  let userId: number | null = null;

  if (session && session.role === "STUDENT" && !session.emailVerifiedAt) {
    email = session.email;
    name = session.name;
    userId = session.id;
  } else {
    const body = await req.json().catch(() => null);
    const candidate = String(body?.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(candidate)) {
      return NextResponse.json({ error: "Provide a valid email." }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { email: candidate } });
    if (!user || user.role !== "STUDENT" || user.emailVerifiedAt) {
      // Don't reveal whether an account exists or is already verified.
      return NextResponse.json({ ok: true });
    }
    email = user.email;
    name = user.name;
    userId = user.id;
  }

  if (!email || !userId || !name) {
    return NextResponse.json({ ok: true });
  }

  const latest = await db.emailVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (
    latest &&
    Date.now() - latest.createdAt.getTime() < MIN_RESEND_MS
  ) {
    return NextResponse.json(
      { error: "Please wait a moment before resending." },
      { status: 429 }
    );
  }

  const token = await createVerificationToken(userId);
  const sent = await sendVerificationEmail({ email, name, verificationToken: token });
  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send the email right now. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
