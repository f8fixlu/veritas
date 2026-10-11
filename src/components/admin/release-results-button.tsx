"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/confirm-modal";

export default function ReleaseResultsButton({
  examId,
  menuItem = false,
}: {
  examId: number;
  menuItem?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function release() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showResult: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not release answers.");
        return;
      }
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={menuItem ? "block" : "inline-flex items-center gap-2"}>
      <button
        type="button"
        className={menuItem ? "menu-item" : "btn btn-primary btn-sm"}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Release answers
      </button>
      {error ? (
        <span
          className={
            menuItem
              ? "block px-4 pb-1 text-xs text-red-600"
              : "text-xs text-red-600"
          }
        >
          {error}
        </span>
      ) : null}
      {confirming ? (
        <ConfirmModal
          title="Release answers?"
          message="Students will see their score plus the full question review with correct answers for this exam."
          confirmLabel="Release"
          busy={busy}
          onConfirm={release}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </span>
  );
}
