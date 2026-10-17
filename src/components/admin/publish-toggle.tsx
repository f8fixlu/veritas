"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/confirm-modal";

const VERIFY_URL = "/api/admin/verify-password";

export default function PublishToggle({
  examId,
  published,
  menuItem = false,
}: {
  examId: number;
  published: boolean;
  menuItem?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  function closeConfirmation() {
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

  async function toggle() {
    if (published && !passwordValid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published: !published,
          ...(published ? { password } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the exam.");
        return;
      }
      closeConfirmation();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onToggleClick() {
    if (published) {
      setError(null);
      setConfirming(true);
      return;
    }
    void toggle();
  }

  if (menuItem) {
    return (
      <>
        <button
          type="button"
          className="menu-item"
          disabled={busy}
          onClick={onToggleClick}
        >
          {published ? "Unpublish" : "Publish exam"}
        </button>
        {error ? (
          <span className="block px-4 pb-1 text-xs text-red-600">{error}</span>
        ) : null}
        {confirming ? (
          <ConfirmModal
            title="Unpublish exam"
            message="Enter your password to unpublish this exam. Students will no longer be able to start it."
            confirmLabel="Unpublish"
            cancelLabel="Keep published"
            busy={busy}
            confirmDisabled={!passwordValid}
            error={error}
            password={password}
            onPasswordChange={onPasswordChange}
            onConfirm={toggle}
            onClose={closeConfirmation}
          />
        ) : null}
      </>
    );
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
        onClick={onToggleClick}
      >
        {published ? "Unpublish" : "Publish exam"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      {confirming ? (
        <ConfirmModal
          title="Unpublish exam"
          message="Enter your password to unpublish this exam. Students will no longer be able to start it."
          confirmLabel="Unpublish"
          cancelLabel="Keep published"
          busy={busy}
          confirmDisabled={!passwordValid}
          error={error}
          password={password}
          onPasswordChange={onPasswordChange}
          onConfirm={toggle}
          onClose={closeConfirmation}
        />
      ) : null}
    </div>
  );
}
