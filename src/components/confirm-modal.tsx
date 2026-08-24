"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, busy]);

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : "btn-primary";

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <h2
            id="confirm-title"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            {title}
          </h2>
          {message ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {message}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${confirmClass}`}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
