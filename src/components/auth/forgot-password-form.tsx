"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, Card, Input } from "@/app/ui";

const COOLDOWN_MS = 5 * 60 * 1000;

function formatRemaining(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!sentAt) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((sentAt + COOLDOWN_MS - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) return;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  const cooldownActive = sentAt !== null && remaining > 0;

  async function submitRequest() {
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // A rejected fetch must surface, not silently return to idle.
      setError(
        "Could not reach the server. Check your connection, wait a moment, then try again."
      );
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return false;
    }
    const now = Date.now();
    setSentAt(now);
    setRemaining(Math.ceil(COOLDOWN_MS / 1000));
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await submitRequest();
      if (ok) setSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (cooldownActive || resending) return;
    setResending(true);
    try {
      await submitRequest();
    } finally {
      setResending(false);
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
            Reset your password
          </h1>
          <p className="text-sm text-slate-500">
            We&apos;ll email you a link to choose a new password
          </p>
        </div>
        {sent ? (
          <Card className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Check your inbox
            </h2>
            <p className="text-sm text-slate-600">
              A password reset link has been sent to{" "}
              <span className="font-medium text-slate-900">{email}</span>. It
              expires in 5 minutes.
            </p>
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="secondary"
                disabled={cooldownActive || resending}
                onClick={() => void onResend()}
              >
                {resending
                  ? "Sending…"
                  : cooldownActive
                    ? `Resend in ${formatRemaining(remaining)}`
                    : "Resend reset link"}
              </Button>
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </Link>
            </div>
          </Card>
        ) : (
          <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <Input
              id="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={busy || cooldownActive}
            >
              {busy
                ? "Sending link…"
                : cooldownActive
                  ? `Resend in ${formatRemaining(remaining)}`
                  : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
