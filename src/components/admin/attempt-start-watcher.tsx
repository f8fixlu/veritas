"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rendered for "Not started" roster rows. Polls the exam status endpoint so
 * the row can flip to a live state the moment the student starts (or finishes
 * very quickly) without a manual refresh. On change it calls router.refresh()
 * so the server re-renders the row with the correct live/progress cell.
 */
export default function AttemptStartWatcher({
  examId,
  userId,
}: {
  examId: number;
  userId: number;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    if (started) return;
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/admin/exams/${examId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data?.students)) return;
        const mine = data.students.find((s: { userId: number }) => s.userId === userId);
        if (!mine) return;
        if (mine.status !== "notstarted") {
          if (cancelled) return;
          setStarted(true);
          if (!refreshing.current) {
            refreshing.current = true;
            router.refresh();
          }
        }
      } catch {
        // transient network error — retry on the next tick
      }
    }

    poll();
    const timer = setInterval(poll, 5000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [examId, userId, started, router]);

  if (started) {
    return <span className="badge bg-amber-50 text-amber-700">In progress</span>;
  }

  return <span className="badge bg-slate-100 text-slate-600">Not started</span>;
}
