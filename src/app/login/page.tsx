"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
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
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-sm text-slate-500">
            New student?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
