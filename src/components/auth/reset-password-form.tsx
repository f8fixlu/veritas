"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useRef, useState } from "react";
import { Button, Card, Input } from "@/app/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not reset your password. Please try again.");
        submitting.current = false;
        setBusy(false);
        return;
      }
      // Push without router.refresh() (see LoginForm): the destination is
      // fetched with the rotated session cookie. Stay busy through the
      // navigation so a slow render can't take a second submit that rotates the
      // session again and strands what the navigation is carrying.
      router.push("/");
    } catch {
      setError(
        "Could not reach the server. Check your connection, wait a moment, then try again."
      );
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            V
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Choose a new password
          </h1>
        </div>
        {!token ? (
          <Card className="space-y-4 p-6 text-center">
            <p className="text-sm text-slate-600">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Request a new link
            </Link>
          </Card>
        ) : (
          <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <Input
              id="password"
              label="New password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              id="confirm-password"
              label="Retype password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Reset password"}
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
