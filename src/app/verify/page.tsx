"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const ran = useRef(false);
  const [state, setState] = useState<"checking" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Verification failed.");
          setState("error");
          return;
        }
        router.replace("/subjects");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
        setState("error");
      }
    })();
  }, [token, router]);

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
        <div className="card space-y-4 p-6 text-center">
          {state === "checking" ? (
            <p className="text-sm text-slate-500">Verifying your email…</p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {error ?? "We could not verify your email."}
              </p>
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
