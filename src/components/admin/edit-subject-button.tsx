"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function EditSubjectButton({
  subjectId,
  name,
  description,
}: {
  subjectId: number;
  name: string;
  description: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [descValue, setDescValue] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameValue.trim(),
          description: descValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          setNameValue(name);
          setDescValue(description ?? "");
          setError(null);
          setOpen(true);
        }}
      >
        Edit details
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div className="flex min-h-full items-center justify-center p-4">
                <form
                  onSubmit={onSubmit}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="edit-subject-title"
                  className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
                >
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                  <h2
                    id="edit-subject-title"
                    className="font-medium text-slate-900"
                  >
                    Edit subject
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Update the name or description
                  </p>

                  <div className="mt-4 space-y-4">
                    {error ? (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                        {error}
                      </p>
                    ) : null}
                    <div>
                      <label htmlFor="edit-subject-name" className="label">
                        Name
                      </label>
                      <input
                        id="edit-subject-name"
                        type="text"
                        required
                        className="input"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-subject-desc" className="label">
                        Description{" "}
                        <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <textarea
                        id="edit-subject-desc"
                        rows={3}
                        className="input"
                        placeholder="What this subject covers"
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
