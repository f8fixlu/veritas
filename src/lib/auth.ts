import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";

export const VERIFY_TOKEN_TTL_MS = 60 * 60 * 24; // 24h

export const SESSION_COOKIE = "veritas_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "veritas-dev-secret-change-me"
);

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
};

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const uid = payload.uid;
    if (typeof uid !== "number") return null;
    const user = await getDb().user.findUnique({ where: { id: uid } });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT" && !user.emailVerifiedAt) {
    redirect("/verify-required");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/subjects");
  return user;
}

export async function requireApiUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "STUDENT" && !user.emailVerifiedAt) return null;
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/**
 * Creates a fresh email-verification token for a user, revoking any previous
 * one. Returns the plaintext token (to send in an email); only its hash is
 * stored.
 */
export async function createVerificationToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const db = getDb();
  await db.emailVerification.deleteMany({ where: { userId } });
  await db.emailVerification.create({
    data: {
      userId,
      tokenHash: hashPassword(token),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });
  return token;
}

/**
 * Validates a verification token, marks the user verified, and returns the
 * user on success (or null if invalid/expired).
 */
export async function verifyEmailToken(
  token: string
): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getDb();
  const verification = await db.emailVerification.findMany({
    include: { user: true },
  });
  const match = verification.find((v) => verifyPassword(token, v.tokenHash));
  if (!match) return null;
  if (match.expiresAt.getTime() < Date.now()) return null;

  const user = match.user;
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    }),
    db.emailVerification.delete({ where: { id: match.id } }),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: new Date(),
  };
}
