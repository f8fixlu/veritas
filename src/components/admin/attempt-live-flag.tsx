"use client";

import { useState } from "react";
import { useSharedPoll } from "@/lib/use-shared-poll";

type LiveFlag = { kind: "none" } | { kind: "warned" } | { kind: "flagged" };

type LiveAttempt = {
  submittedAtISO?: string | null;
  focusLosses?: number;
  totalFocusLossMs?: number;
  maxBlurMs?: number;
};

type ExamStatusPayload = {
  attempts?: Record<string, LiveAttempt>;
};

function deriveFlag(
  losses: number,
  totalMs: number,
  maxMs: number
): LiveFlag {
  if (losses >= 3 || maxMs >= 30_000 || totalMs >= 60_000) {
    return { kind: "flagged" };
  }
  if (losses >= 1 || maxMs >= 15_000 || totalMs >= 30_000) {
    return { kind: "warned" };
  }
  return { kind: "none" };
}

function fmtDuration(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

/**
 * Live in-progress flag view. Shares the exam's single status poll with every
 * other live row and shows any anti-cheat flag the moment the student crosses a
 * threshold, without a page refresh. Stops polling once the attempt is
 * submitted.
 */
export default function AttemptLiveFlag({
  attemptId,
  examId,
}: {
  attemptId: number;
  examId: number;
}) {
  const [flag, setFlag] = useState<LiveFlag>({ kind: "none" });
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useSharedPoll<ExamStatusPayload>(
    submitted ? "" : `/api/admin/exams/${examId}/status`,
    5000,
    (data) => {
      const mine = data.attempts?.[String(attemptId)];
      if (!mine) return;
      if (mine.submittedAtISO) {
        setSubmitted(true);
        return;
      }
      const losses = mine.focusLosses ?? 0;
      const totalMs = mine.totalFocusLossMs ?? 0;
      const maxMs = mine.maxBlurMs ?? 0;
      setFlag(deriveFlag(losses, totalMs, maxMs));
      const reasons: string[] = [];
      if (losses >= 3) reasons.push(`Left the page ${losses} times`);
      if (maxMs >= 30_000) reasons.push(`Away ${fmtDuration(maxMs)} at once`);
      if (totalMs >= 60_000) reasons.push(`Away ${fmtDuration(totalMs)} in total`);
      setDetail(reasons.join("\n"));
    }
  );

  if (submitted) return null;

  if (flag.kind === "none") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
        title="Live flag — updates automatically"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-slate-500" />
        </span>
        None
      </span>
    );
  }

  const flagged = flag.kind === "flagged";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        flagged ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
      }`}
      title={detail || "Flagged"}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
            flagged ? "bg-red-500" : "bg-amber-500"
          }`}
        />
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            flagged ? "bg-red-600" : "bg-amber-600"
          }`}
        />
      </span>
      {flagged ? "Flagged" : "Warning"}
    </span>
  );
}
