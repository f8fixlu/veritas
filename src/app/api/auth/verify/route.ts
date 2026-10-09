import { NextResponse } from "next/server";
import {
  rotateSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyEmailToken,
} from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

const IP_LIMIT = 60;
const IP_WINDOW_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const ipLimit = rateLimit(
    `verify:ip:${clientIp(req) ?? "unknown"}`,
    IP_LIMIT,
    IP_WINDOW_MS
  );
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
  }

  const user = await verifyEmailToken(token);
  if (!user) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  const sessionToken = await rotateSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions);
  return res;
}
