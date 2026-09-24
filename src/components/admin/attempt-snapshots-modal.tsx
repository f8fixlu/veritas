"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type SnapshotItem = { id: number; capturedAtISO: string; url: string };

type SnapshotData = {
  studentName: string;
  studentEmail: string;
  examTitle: string;
  cameraEnabled: boolean;
  snapshotCount: number;
  snapshots: SnapshotItem[];
};

function snapshotTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AttemptSnapshotsModal({
  attemptId,
  onClose,
}: {
  attemptId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/attempts/${attemptId}/snapshots`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json) setData(json as SnapshotData);
        else setError(json?.error ?? "Could not load snapshots.");
      } catch {
        if (!cancelled) setError("Could not load snapshots.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const count = data?.snapshots.length ?? 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (viewingIndex !== null) setViewingIndex(null);
        else onClose();
      } else if (e.key === "ArrowLeft" && viewingIndex !== null && count > 0) {
        e.preventDefault();
        setViewingIndex((viewingIndex + count - 1) % count);
      } else if (e.key === "ArrowRight" && viewingIndex !== null && count > 0) {
        e.preventDefault();
        setViewingIndex((viewingIndex + 1) % count);
      }
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, viewingIndex, count]);

  const viewing =
    viewingIndex !== null && data ? data.snapshots[viewingIndex] : null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshots-modal-title"
          className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            ×
          </button>

          {error ? (
            <div>
              <h2
                id="snapshots-modal-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Webcam snapshots
              </h2>
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
              <div className="mt-5 flex justify-end">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div className="pr-8">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Webcam snapshots
                </p>
                <h2
                  id="snapshots-modal-title"
                  className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900"
                >
                  {data.studentName}
                </h2>
                <p className="text-sm text-slate-500">
                  {data.studentEmail} · {data.examTitle}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">
                  {data.snapshots.length} photo
                  {data.snapshots.length === 1 ? "" : "s"} captured
                </span>
                <span
                  className={`badge ${
                    data.cameraEnabled
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {data.cameraEnabled ? "Camera on" : "Camera off"}
                </span>
              </div>

              {data.snapshots.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No snapshots captured for this attempt.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {data.snapshots.map((snapshot, index) => (
                    <button
                      key={snapshot.id}
                      type="button"
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition duration-200 hover:border-slate-300 hover:shadow-md"
                      onClick={() => setViewingIndex(index)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin-only authenticated image, next/image can't fetch it */}
                      <img
                        src={snapshot.url}
                        alt={`Snapshot ${snapshotTime(snapshot.capturedAtISO)}`}
                        className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <span className="block truncate px-1.5 py-1 text-[10px] tabular-nums text-slate-500">
                        {snapshotTime(snapshot.capturedAtISO)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {viewing && viewingIndex !== null ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/85 p-6"
          onClick={() => setViewingIndex(null)}
        >
          <button
            type="button"
            aria-label="Previous snapshot"
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setViewingIndex((viewingIndex + count - 1) % count);
            }}
          >
            ‹
          </button>
          <figure className="mx-14 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-only authenticated image, next/image can't fetch it */}
            <img
              src={viewing.url}
              alt={`Snapshot ${snapshotTime(viewing.capturedAtISO)}`}
              className="max-h-[80vh] w-full rounded-xl object-contain shadow-2xl"
            />
            <figcaption className="mt-2 text-center text-xs text-slate-300">
              {viewingIndex + 1} / {count} · {snapshotTime(viewing.capturedAtISO)}
            </figcaption>
          </figure>
          <button
            type="button"
            aria-label="Next snapshot"
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setViewingIndex((viewingIndex + 1) % count);
            }}
          >
            ›
          </button>
          <button
            type="button"
            aria-label="Close snapshot"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
            onClick={() => setViewingIndex(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}