"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import ConfirmModal from "@/components/confirm-modal";

export type RunnerQuestion = {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

export default function ExamRunner({
  attemptId,
  examTitle,
  endsAtISO,
  initialAnswers,
  questions,
}: {
  attemptId: number;
  examTitle: string;
  endsAtISO: string;
  initialAnswers: Record<number, string>;
  questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const deadline = useMemo(() => new Date(endsAtISO).getTime(), [endsAtISO]);

  const normalizedInitial = useMemo<Record<number, Letter>>(() => {
    const out: Record<number, Letter> = {};
    for (const [idStr, val] of Object.entries(initialAnswers ?? {})) {
      const id = Number(idStr);
      const letter = String(val).toUpperCase();
      if (
        (LETTERS as readonly string[]).includes(letter) &&
        questions.some((q) => q.id === id)
      ) {
        out[id] = letter as Letter;
      }
    }
    return out;
  }, [initialAnswers, questions]);

  const [answers, setAnswers] =
    useState<Record<number, Letter>>(normalizedInitial);
  const answersRef = useRef<Record<number, Letter>>(normalizedInitial);
  const lastSavedRef = useRef(JSON.stringify(normalizedInitial));
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      const payload = Object.entries(answersRef.current).map(
        ([questionId, selected]) => ({
          questionId: Number(questionId),
          selected,
        })
      );
      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: payload, auto }),
        });
        if (!res.ok && res.status !== 409) {
          throw new Error("submit failed");
        }
        submittedRef.current = true;
        router.replace(`/result/${attemptId}`);
      } catch {
        submittingRef.current = false;
        setSubmitting(false);
        setError(
          auto
            ? "Time is up but submission failed. Press Submit to try again."
            : "Submission failed. Please check your connection and try again."
        );
      }
    },
    [attemptId, router]
  );

  useEffect(() => {
    async function flushSave() {
      if (submittedRef.current || submittingRef.current) return;
      const snapshot = JSON.stringify(answersRef.current);
      if (snapshot === lastSavedRef.current) return;
      try {
        const res = await fetch(`/api/attempts/${attemptId}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: Object.entries(answersRef.current).map(
              ([questionId, selected]) => ({
                questionId: Number(questionId),
                selected,
              })
            ),
          }),
        });
        if (res.ok) {
          lastSavedRef.current = snapshot;
        } else if (res.status === 409) {
          submittedRef.current = true;
        }
      } catch {}
    }

    const timer = setInterval(() => {
      setRemainingMs(deadline - Date.now());
      void flushSave();
      if (deadline - Date.now() <= 0) void submit(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [deadline, submit, attemptId]);

  function select(questionId: number, letter: Letter) {
    const next = { ...answersRef.current, [questionId]: letter };
    answersRef.current = next;
    setAnswers(next);
  }

  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const urgent = remainingMs !== null && remainingMs <= 60_000;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {examTitle}
            </h1>
            <p className="text-xs text-slate-500">
              {answeredCount} of {total} answered
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-base font-semibold tabular-nums ${
              urgent
                ? "animate-pulse bg-red-50 text-red-600"
                : "bg-indigo-50 text-indigo-700"
            }`}
            aria-label="Time remaining"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                urgent ? "bg-red-500" : "bg-indigo-500"
              }`}
            />
            {remainingMs === null ? "--:--" : formatClock(remainingMs)}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-28">
        {questions.map((question, index) => (
          <section key={question.id} className="card p-5">
            <h2 className="font-medium leading-relaxed text-slate-900">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {index + 1}
              </span>
              {question.text}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {LETTERS.map((letter) => {
                const value = question[`option${letter}` as const];
                const selected = answers[question.id] === letter;
                return (
                  <label
                    key={letter}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                      selected
                        ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      className="sr-only"
                      checked={selected}
                      onChange={() => select(question.id, letter)}
                    />
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        selected
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {letter}
                    </span>
                    <span>{value}</span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm text-slate-500">
            {answeredCount === total
              ? "All questions answered"
              : `${total - answeredCount} unanswered`}
          </p>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting}
            onClick={() => setConfirming(true)}
          >
            Submit exam
          </button>
        </div>
      </div>

      {confirming ? (
        <ConfirmModal
          title="Submit your exam?"
          message="You cannot change your answers afterwards."
          confirmLabel="Submit exam"
          cancelLabel="Keep editing"
          variant="primary"
          busy={submitting}
          onConfirm={() => {
            setConfirming(false);
            void submit(false);
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
