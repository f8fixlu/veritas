"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AttemptLiveProgress({
  attemptId,
  initialAnswered,
  total,
}: {
  attemptId: number;
  initialAnswered: number;
  total: number;
}) {
  const router = useRouter();
  const [answered, setAnswered] = useState(initialAnswered);
  const [submitted, setSubmitted] = useState(false);
  const refreshedRef = useRef(false);

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
        setAnswered(data.answered ?? 0);
        if (data.submittedAtISO) {
          if (!refreshedRef.current) {
            refreshedRef.current = true;
            setSubmitted(true);
            router.refresh();
          }
        } else {
          refreshedRef.current = false;
        }
      } catch {
        // network hiccup — retry on the next tick
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
  }, [attemptId, router]);

  if (submitted) {
    return (
      <span className="badge bg-emerald-50 text-emerald-700">Completed</span>
    );
  }

  const unanswered = Math.max(0, total - answered);
  return (
    <span
      className="badge bg-amber-50 text-amber-700"
      title={`${unanswered} unanswered — updates automatically`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600" />
      </span>
      {`${answered}/${total} answered`}
    </span>
  );
}
