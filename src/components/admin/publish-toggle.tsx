"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PublishToggle({
  examId,
  published,
}: {
  examId: number;
  published: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the exam.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={
          published
            ? "badge bg-emerald-50 text-emerald-700"
            : "badge bg-slate-100 text-slate-600"
        }
      >
        {published ? "Published" : "Draft"}
      </span>
      <button
        type="button"
        className={`btn btn-sm ${published ? "btn-secondary" : "btn-primary"}`}
        disabled={busy}
        onClick={toggle}
      >
        {published ? "Unpublish" : "Publish exam"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
