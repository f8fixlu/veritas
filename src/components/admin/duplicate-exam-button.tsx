"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DuplicateExamButton({ examId }: { examId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDuplicate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not duplicate the exam.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={onDuplicate}
      >
        {busy ? "…" : "Duplicate"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
