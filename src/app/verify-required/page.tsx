import { redirect } from "next/navigation";
import Link from "next/link";
import ResendVerificationButton from "@/components/resend-verification-button";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Verify your email — Veritas" };

export default async function VerifyRequiredPage() {
  const user = await getSessionUser();

  if (!user) redirect("/login");
  if (user.role === "ADMIN" || user.emailVerifiedAt) redirect("/subjects");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            V
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Verify your email
          </h1>
        </div>
        <div className="card space-y-4 p-6">
          <p className="text-sm text-slate-600">
            Before you can take exams, confirm your email. We sent a link to{" "}
            <span className="font-medium text-slate-900">{user.email}</span> —
            open it to activate your account.
          </p>
          <p className="text-xs text-slate-400">
            Didn&apos;t get it? Check spam, then resend below.
          </p>
          <ResendVerificationButton />
          <p className="text-center text-sm">
            <Link
              href="/logout"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign out
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
