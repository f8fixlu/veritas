"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/confirm-modal";

export default function DeleteButton({
  endpoint,
  confirmText,
  label = "Delete",
  redirectOnSuccess,
}: {
  endpoint: string;
  confirmText: string;
  label?: string;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed.");
        return;
      }
      setConfirming(false);
      if (redirectOnSuccess) router.push(redirectOnSuccess);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        {busy ? "…" : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {confirming ? (
        <ConfirmModal
          title="Confirm deletion"
          message={confirmText}
          confirmLabel="Delete"
          cancelLabel="Keep"
          variant="danger"
          busy={busy}
          onConfirm={onDelete}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </span>
  );
}
