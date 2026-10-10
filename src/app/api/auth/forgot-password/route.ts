import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

const MIN_RESEND_MS = 5 * 60 * 1000;
const IP_LIMIT = 15;
const IP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ipLimit = rateLimit(
    `forgot:ip:${clientIp(req) ?? "unknown"}`,
    IP_LIMIT,
    IP_WINDOW_MS
  );
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Provide a valid email." }, { status: 400 });
  }

  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "No account is registered with that email." },
      { status: 404 }
    );
  }

  const latest = await db.passwordReset.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < MIN_RESEND_MS) {
    return NextResponse.json(
      { error: "Please wait a moment before requesting another link." },
      { status: 429 }
    );
  }

  // Without a mail provider (e.g. local development) there is no way to deliver
  // the link. Acknowledge without sending to keep the flow usable.
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `[mail] RESEND_API_KEY not set; password reset for ${email} was not sent.`
    );
    return NextResponse.json({ ok: true });
  }

  const token = await createPasswordResetToken(user.id);
  const sent = await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetToken: token,
  });
  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send the email right now. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
