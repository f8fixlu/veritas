"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/confirm-modal";

const VERIFY_URL = "/api/admin/verify-password";

export default function DeleteButton({
  endpoint,
  confirmText,
  label = "Delete",
  redirectOnSuccess,
  requirePassword = false,
}: {
  endpoint: string;
  confirmText: string;
  label?: string;
  redirectOnSuccess?: string;
  requirePassword?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  function onClose() {
    setConfirming(false);
    setPassword("");
    setPasswordValid(false);
    setError(null);
    if (checkTimer.current) {
      clearTimeout(checkTimer.current);
      checkTimer.current = null;
    }
  }

  function onPasswordChange(value: string) {
    setPassword(value);
    setPasswordValid(false);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!requirePassword) return;
    // Only verify once the password reaches the minimum account length.
    if (value.length < 6) return;
    checkTimer.current = setTimeout(async () => {
      checkTimer.current = null;
      const seq = ++checkSeq.current;
      try {
        const res = await fetch(VERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (seq !== checkSeq.current) return;
        setPasswordValid(Boolean(data.valid));
      } catch {
        if (seq !== checkSeq.current) return;
        setPasswordValid(false);
      }
    }, 400);
  }

  async function onDelete() {
    if (requirePassword && !passwordValid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: requirePassword ? { "Content-Type": "application/json" } : undefined,
        body: requirePassword ? JSON.stringify({ password }) : undefined,
      });
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
          confirmDisabled={requirePassword && !passwordValid}
          password={password}
          onPasswordChange={requirePassword ? onPasswordChange : undefined}
          onConfirm={onDelete}
          onClose={onClose}
        />
      ) : null}
    </span>
  );
}