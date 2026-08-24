"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PasswordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-modal-title"
        className="relative my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="pw-modal-title" className="font-medium text-slate-900">
          Change password
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Choose a password of at least 6 characters
        </p>

        <div className="mt-4 space-y-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password updated. Use your new password next time you sign in.
            </p>
          ) : null}
          <div>
            <label htmlFor="pw-current" className="label">Current password</label>
            <input
              id="pw-current"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pw-new" className="label">New password</label>
            <input
              id="pw-new"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="label">Confirm new password</label>
            <input
              id="pw-confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>,
      document.body
    );
}
