"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SubjectTokenCard({
  subjectId,
  subjectName,
  token,
}: {
  subjectId: number;
  subjectName: string;
  token: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy — copy the code below manually.");
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}/join-token`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not regenerate the token.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-medium text-slate-900">Enrollment token</h2>
        <p className="text-sm text-slate-500">
          Students join &ldquo;{subjectName}&rdquo; with this code on their
          dashboard.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-lg font-bold tracking-[0.3em] text-slate-800">
          {token}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={copy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          onClick={regenerate}
        >
          {busy ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}