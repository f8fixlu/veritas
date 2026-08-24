"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartExamButton({
  examId,
  label = "Start exam",
}: {
  examId: number;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/exams/${examId}/start`, { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(data.error ?? "Could not start the exam.");
              return;
            }
            router.push(
              data.ended ? `/result/${data.attemptId}` : `/attempt/${data.attemptId}`
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing…" : label}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
