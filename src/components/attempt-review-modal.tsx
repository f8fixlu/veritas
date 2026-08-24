"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { percent } from "@/lib/format";

const LETTERS = ["A", "B", "C", "D"] as const;

type ReviewQuestion = {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  selected: string | null;
};

type ReviewData = {
  id: number;
  studentName: string;
  studentEmail: string;
  examTitle: string;
  subjectName: string;
  submittedAtISO: string | null;
  score: number | null;
  total: number | null;
  questions: ReviewQuestion[];
};

function scoreBadgeClass(pct: number): string {
  if (pct >= 75) return "bg-emerald-50 text-emerald-700";
  if (pct >= 50) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default function AttemptReviewModal({
  attemptId,
  onClose,
}: {
  attemptId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/attempts/${attemptId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load the review.");
          return;
        }
        if (!cancelled) setData(json as ReviewData);
      } catch {
        if (!cancelled) setError("Could not load the review.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const pct = data ? percent(data.score, data.total) : 0;

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
          aria-labelledby="review-modal-title"
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
                id="review-modal-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Answer review
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
                  Answer review
                </p>
                <h2
                  id="review-modal-title"
                  className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900"
                >
                  {data.studentName}
                </h2>
                <p className="text-sm text-slate-500">
                  {data.examTitle} · {data.subjectName}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {data.submittedAtISO
                    ? `Submitted ${new Date(data.submittedAtISO).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}`
                    : "Not submitted yet"}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Result</span>
                <span className={`badge ${scoreBadgeClass(pct)}`}>
                  {`${data.score ?? 0}/${data.total ?? 0} \u00b7 ${pct}%`}
                </span>
              </div>

              <ul className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {data.questions.map((question, index) => (
                  <li key={question.id} className="rounded-xl border border-slate-200 p-4">
                    <h3 className="font-medium leading-relaxed text-slate-900">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      {question.text}
                    </h3>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {LETTERS.map((letter) => {
                        const value = question[`option${letter}` as const];
                        const isCorrect = question.correctOption === letter;
                        const isPicked = question.selected === letter;
                        let cls = "border-slate-200 bg-white text-slate-700";
                        if (isCorrect) {
                          cls = "border-emerald-300 bg-emerald-50 text-emerald-800";
                        } else if (isPicked) {
                          cls = "border-red-300 bg-red-50 text-red-800";
                        }
                        return (
                          <div
                            key={letter}
                            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                isCorrect
                                  ? "border-emerald-500 bg-emerald-600 text-white"
                                  : isPicked
                                    ? "border-red-400 bg-red-500 text-white"
                                    : "border-slate-300 text-slate-500"
                              }`}
                            >
                              {letter}
                            </span>
                            <span>{value}</span>
                            {isPicked && !isCorrect ? (
                              <span className="ml-auto mt-0.5 text-xs font-medium">
                                their pick
                              </span>
                            ) : null}
                            {isCorrect ? (
                              <span className="ml-auto mt-0.5 text-xs font-medium">
                                correct
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {!question.selected ? (
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        Not answered.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex justify-end">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
