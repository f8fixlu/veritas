"use client";

import { useEffect, useState } from "react";

type LiveFlag = { kind: "none" } | { kind: "warned" } | { kind: "flagged" };

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
 * Live in-progress flag view. Polls the same progress endpoint as the status
 * column and shows any anti-cheat flag the moment the student crosses a
 * threshold, without a page refresh.
 */
export default function AttemptLiveFlag({ attemptId }: { attemptId: number }) {
  const [flag, setFlag] = useState<LiveFlag>({ kind: "none" });
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/admin/attempts/${attemptId}/progress`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.submittedAtISO) {
          setSubmitted(true);
          return;
        }
        const losses = data.focusLosses ?? 0;
        const totalMs = data.totalFocusLossMs ?? 0;
        const maxMs = data.maxBlurMs ?? 0;
        setFlag(deriveFlag(losses, totalMs, maxMs));
        const reasons: string[] = [];
        if (losses >= 3) reasons.push(`Left the page ${losses} times`);
        if (maxMs >= 30_000) reasons.push(`Away ${fmtDuration(maxMs)} at once`);
        if (totalMs >= 60_000) reasons.push(`Away ${fmtDuration(totalMs)} in total`);
        setDetail(reasons.join("\n"));
      } catch {
        // transient network error — retry on the next tick
      }
    }

    poll();
    const timer = setInterval(poll, 5000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [attemptId]);

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
