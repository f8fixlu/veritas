"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function JoinTokenForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/subjects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not join that subject.");
        return;
      }
      setToken("");
      setMessage(
        `You joined ${data.subjectName ?? "the subject"}${
          data.ownerName ? ` · ${data.ownerName}` : ""
        }.`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card card-soft mb-6 space-y-3 px-5 py-4"
    >
      <div>
        <label
          htmlFor="join-token"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Have an enrollment token?
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            id="join-token"
            type="text"
            className="input min-w-0 flex-1 font-mono tracking-widest uppercase"
            placeholder="e.g. XK7BQP"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="btn btn-primary shrink-0"
            disabled={busy || token.length !== 6}
          >
            {busy ? "Joining…" : "Join subject"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}