"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, CardSoft } from "@/app/ui";

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
        data.alreadyEnrolled
          ? data.ownerName
            ? "You were already enrolled in " +
              (data.subjectName ?? "the subject") +
              " and are now connected to " +
              data.ownerName +
              "."
            : "You are already enrolled in " +
              (data.subjectName ?? "the subject") +
              "."
          : data.ownerName
            ? "You joined " +
              (data.subjectName ?? "the subject") +
              " and are now connected to " +
              data.ownerName +
              "."
            : "You joined " + (data.subjectName ?? "the subject") + "."
      );
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardSoft
      as="form"
      onSubmit={onSubmit}
      className="space-y-3 px-5 py-4"
    >
      <div>
        <h2 className="font-medium text-slate-900">Join subject</h2>
        <p className="mt-1 text-sm text-slate-500">
          Joining also connects your account to the subject&apos;s instructor.
        </p>
      </div>
      <div>
        <label
          htmlFor="join-token"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Subject code
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
          <Button
            type="submit"
            variant="primary"
            className="shrink-0"
            disabled={busy || token.length !== 6}
          >
            {busy ? "Joining…" : "Join subject"}
          </Button>
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
    </CardSoft>
  );
}
