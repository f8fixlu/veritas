import { NextResponse } from "next/server";
import {
  consumePasswordResetToken,
  hashPassword,
  rotateSession,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

const IP_LIMIT = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ipLimit = rateLimit(
    `reset:ip:${clientIp(req) ?? "unknown"}`,
    IP_LIMIT,
    IP_WINDOW_MS
  );
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const db = getDb();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  // Following the emailed link proves control of the mailbox, so an unverified
  // account is marked verified as part of the reset.
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  // Revoke every existing session; sign the user in on this device.
  const sessionToken = await rotateSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions);
  return res;
}
