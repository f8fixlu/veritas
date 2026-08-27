"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import ConfirmModal from "@/components/confirm-modal";

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

export type RunnerQuestion = {
  id: number;
  text: string;
  options: {
    letter: string;
    canonical: Letter;
    text: string;
  }[];
  sectionId?: number | null;
  sectionName?: string | null;
  sectionDetails?: string | null;
  sectionPoints?: number | null;
};

const QUESTIONS_PER_PAGE = 5;

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
  const [pageIndex, setPageIndex] = useState(0);

  const focusRef = useRef({ losses: 0, totalMs: 0, maxMs: 0 });
  const blurStartedRef = useRef<number | null>(null);

  useEffect(() => {
    const isHidden = () => document.visibilityState === "hidden";
    const onAway = () => {
      // Native blur fires before visibilitychange; guard so a single leave
      // counts once.
      if (blurStartedRef.current !== null) return;
      if (document.hasFocus() && !isHidden()) return;
      blurStartedRef.current = Date.now();
    };
    const onBack = () => {
      if (blurStartedRef.current === null) return;
      const gap = Date.now() - blurStartedRef.current;
      blurStartedRef.current = null;
      const f = focusRef.current;
      f.losses += 1;
      f.totalMs += gap;
      if (gap > f.maxMs) f.maxMs = gap;
    };
    const onVisibility = () => {
      if (isHidden()) onAway();
      else onBack();
    };
    window.addEventListener("blur", onAway);
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onAway);
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const focusPayload = () => ({
    losses: focusRef.current.losses,
    totalMs: focusRef.current.totalMs,
    maxMs: focusRef.current.maxMs,
  });

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
          body: JSON.stringify({ answers: payload, auto, focus: focusPayload() }),
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
            focus: focusPayload(),
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

  const pageCount = Math.max(1, Math.ceil(total / QUESTIONS_PER_PAGE));
  const safeIndex = Math.min(pageIndex, pageCount - 1);
  const visible = questions.slice(
    safeIndex * QUESTIONS_PER_PAGE,
    safeIndex * QUESTIONS_PER_PAGE + QUESTIONS_PER_PAGE
  );

  const unansweredItems = questions
    .map((q, index) => (answers[q.id] ? null : index + 1))
    .filter((n): n is number => n !== null);

  const topRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    topRef.current?.focus({ preventScroll: true });
  }, [safeIndex]);

  return (
    <div
      className="min-h-screen select-none bg-slate-50"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
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

      <main
        ref={topRef}
        tabIndex={-1}
        className="no-print mx-auto max-w-3xl space-y-4 px-4 py-6 pb-28 scroll-mt-16 focus:outline-none"
      >
        {visible.length > 0 ? (
          <div className="space-y-4">
            {visible.map((question, offset) => {
              const globalIndex = safeIndex * QUESTIONS_PER_PAGE + offset;
              const prev = globalIndex > 0 ? questions[globalIndex - 1] : null;
              const sectionChanged =
                question.sectionName != null &&
                (prev == null || prev.sectionId !== question.sectionId);
              const answered = answers[question.id] !== undefined;
              return (
                <div key={question.id} className="space-y-4">
                  {sectionChanged ? (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3">
                      <p className="text-sm font-semibold text-indigo-900">
                        {question.sectionName}
                        {question.sectionPoints ? (
                          <span className="ml-2 font-normal text-indigo-700">
                            · {question.sectionPoints} pt
                            {question.sectionPoints === 1 ? "" : "s"} per question
                          </span>
                        ) : null}
                      </p>
                      {question.sectionDetails ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-indigo-700">
                          {question.sectionDetails}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <section
                    className={`card p-5 ${answered ? "" : "ring-2 ring-red-300"}`}
                  >
                    <h2 className="font-medium leading-relaxed text-slate-900">
                      <span
                        className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          answered
                            ? "bg-slate-100 text-slate-600"
                            : "bg-red-100 text-red-600"
                        }`}
                        title={answered ? undefined : "Not answered yet"}
                      >
                        {globalIndex + 1}
                      </span>
                      {question.text}
                    </h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {question.options.map((option) => {
                        const selected = answers[question.id] === option.canonical;
                        return (
                          <label
                            key={option.canonical}
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
                              onChange={() => select(question.id, option.canonical)}
                            />
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                                selected
                                  ? "border-indigo-500 bg-indigo-600 text-white"
                                  : "border-slate-300 text-slate-500"
                              }`}
                            >
                              {option.letter}
                            </span>
                            <span>{option.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                </div>
              );
            })}
            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safeIndex === 0}
                  onClick={() => setPageIndex(safeIndex - 1)}
                >
                  &larr; Previous
                </button>
                <span className="text-xs text-slate-500">
                  Page {safeIndex + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={safeIndex >= pageCount - 1}
                  onClick={() => setPageIndex(safeIndex + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center pt-1">
                <span className="text-xs text-slate-500">
                  All {total} question{total === 1 ? "" : "s"} on one page
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-10 text-center text-sm text-slate-500">
            This exam has no questions.
          </div>
        )}
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
          title={
            unansweredItems.length === 0
              ? "Submit your exam?"
              : "Submit with unanswered questions?"
          }
          message={
            unansweredItems.length === 0
              ? `All ${total} questions are answered. You cannot change your answers afterwards.`
              : `You still have ${unansweredItems.length} unanswered question${
                  unansweredItems.length === 1 ? "" : "s"
                } — item${unansweredItems.length === 1 ? "" : "s"} ${unansweredItems.join(
                  ", "
                )}. You cannot change your answers afterwards.`
          }
          confirmLabel="Submit exam"
          cancelLabel="Keep editing"
          variant={unansweredItems.length === 0 ? "primary" : "danger"}
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
