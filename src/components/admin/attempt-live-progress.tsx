"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/ui";
import { useSharedPoll } from "@/lib/use-shared-poll";
import { scheduleRefresh } from "@/lib/coalesced-refresh";

type LiveAttempt = {
  answered?: number;
  submittedAtISO?: string | null;
};

type ExamStatusPayload = {
  attempts?: Record<string, LiveAttempt>;
};

/**
 * Live answered-count badge for an in-progress attempt. Shares the exam's
 * single status poll with every other live row (and with the live summary
 * cards / start watchers) so a full roster costs one request per tick, not one
 * per row. Stops polling once the attempt is submitted.
 */
export default function AttemptLiveProgress({
  attemptId,
  examId,
  initialAnswered,
  total,
}: {
  attemptId: number;
  examId: number;
  initialAnswered: number;
  total: number;
}) {
  const router = useRouter();
  const [answered, setAnswered] = useState(initialAnswered);
  const [submitted, setSubmitted] = useState(false);
  const refreshedRef = useRef(false);

  useSharedPoll<ExamStatusPayload>(
    submitted ? "" : `/api/admin/exams/${examId}/status`,
    5000,
    (data) => {
      const mine = data.attempts?.[String(attemptId)];
      if (!mine) return;
      if (typeof mine.answered === "number") setAnswered(mine.answered);
      if (mine.submittedAtISO) {
        if (!refreshedRef.current) {
          refreshedRef.current = true;
          setSubmitted(true);
          scheduleRefresh(() => router.refresh());
        }
      } else {
        refreshedRef.current = false;
      }
    }
  );

  if (submitted) {
    return <Badge variant="success">Completed</Badge>;
  }

  const unanswered = Math.max(0, total - answered);
  return (
    <Badge
      variant="warning"
      title={`${unanswered} unanswered — updates automatically`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600" />
      </span>
      <span>
        {`${answered}/${total}`}
        <span className="hidden sm:inline"> answered</span>
      </span>
    </Badge>
  );
}
