"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { Button, Card, Input } from "@/app/ui";

export default function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // A ref (not just `busy`) because a fast second submit can fire before the
    // disabled state commits. Two concurrent logins each bump the account's
    // sessionVersion and the browser can keep the older token, which the server
    // then rejects as a revoked session — the user silently lands back here.
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign in failed. Please try again.");
        submitting.current = false;
        setBusy(false);
        return;
      }
      // Push straight to the role's landing page. Do NOT also call
      // router.refresh(): the two navigations race, and refreshing re-renders
      // the current (/login) route, which can drop the pending push. Dynamic
      // routes are never served from the client router cache (staleTimes
      // .dynamic defaults to 0), so the destination is fetched with the new
      // session cookie regardless.
      router.push(
        data.role === "ADMIN" || data.role === "INSTRUCTOR" ? "/admin" : "/subjects"
      );
      // Deliberately stay busy through the navigation. Re-enabling the button
      // here lets the student submit a *second* login while the destination is
      // slow to render (which is exactly when the server is under load): that
      // second call rotates sessionVersion again and strands the cookie the
      // in-flight navigation is carrying, so the server bounces them back to
      // /login with no error — the reported "it just refreshes the page".
    } catch {
      // A rejected fetch (saturated/restarting server, dropped connection) must
      // surface as an error instead of silently re-enabling the form.
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
            Sign in to Veritas
          </h1>
          <p className="text-sm text-slate-500">Online examination system</p>
        </div>
        <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
          {notice ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {notice}
            </p>
          ) : null}
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
          <Input
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-slate-500">
            New student?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}