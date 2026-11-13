"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, CardSoft } from "@/app/ui";

type Instructor = { id: number; name: string };

export default function LinkInstructorForm({
  instructors,
}: {
  instructors: Instructor[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorCode: code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not link that instructor.");
        return;
      }
      setCode("");
      setMessage(`Your account is now linked to ${data.instructorName}.`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardSoft as="form" onSubmit={onSubmit} className="space-y-3 px-5 py-4">
      <div>
        <h2 className="font-medium text-slate-900">Link an instructor</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter their 6-character code. They can then see your student profile
          and add you to their subjects.
        </p>
      </div>
      <div>
        <label
          htmlFor="instructor-code"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Instructor code
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            id="instructor-code"
            type="text"
            className="input min-w-0 flex-1 font-mono tracking-widest uppercase"
            placeholder="e.g. XK7BQP"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Button
            type="submit"
            variant="primary"
            className="shrink-0"
            disabled={busy || code.trim().length !== 6}
          >
            {busy ? "Linking…" : "Link instructor"}
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

      {instructors.length > 0 ? (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Linked instructors
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {instructors.map((instructor) => (
              <li key={instructor.id}>
                <Badge variant="slate">{instructor.name}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CardSoft>
  );
}
