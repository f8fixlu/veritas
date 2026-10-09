import { NextResponse } from "next/server";
import {
  rotateSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rateLimit, resetRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

const IP_LIMIT = 30;
const IP_WINDOW_MS = 5 * 60 * 1000;
const ACCOUNT_LIMIT = 10;
const ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const ipLimit = rateLimit(
      `login:ip:${clientIp(req) ?? "unknown"}`,
      IP_LIMIT,
      IP_WINDOW_MS
    );
    if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterSeconds);

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Throttle per account as well as per IP, so one host cannot burn through
    // bcrypt for a single address (and spoofed X-Forwarded-For alone won't help).
    const accountKey = `login:account:${email}`;
    const accountLimit = rateLimit(accountKey, ACCOUNT_LIMIT, ACCOUNT_WINDOW_MS);
    if (!accountLimit.allowed) return tooManyRequests(accountLimit.retryAfterSeconds);

    const db = getDb();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    resetRateLimit(accountKey);
    const token = await rotateSession(user.id);
    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (err) {
    // An unexpected failure (e.g. an un-migrated database) must not leak a
    // bare HTML/empty 500 to the client: log the real cause for the operator
    // and return JSON the login form can display.
    console.error("login failed:", err);
    return NextResponse.json(
      { error: "Sign in failed. Please try again." },
      { status: 500 }
    );
  }
}
