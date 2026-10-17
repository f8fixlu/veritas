"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/ui";
import { useSharedPoll } from "@/lib/use-shared-poll";
import { scheduleRefresh } from "@/lib/coalesced-refresh";

type StatusPayload = {
  students?: Array<{ userId: number; status: string }>;
};

/**
 * Rendered for "Not started" roster rows. Shares the exam-status poll so the
 * row can flip to a live state the moment the student starts (or finishes very
 * quickly) without a manual refresh. On change it asks for a (coalesced) server
 * re-render so the row picks up the correct live/progress cell, then stops
 * watching.
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

  useSharedPoll<StatusPayload>(
    started ? "" : `/api/admin/exams/${examId}/status`,
    5000,
    (data) => {
      const mine = data.students?.find((s) => s.userId === userId);
      if (!mine || mine.status === "notstarted") return;
      setStarted(true);
      if (!refreshing.current) {
        refreshing.current = true;
        scheduleRefresh(() => router.refresh());
      }
    }
  );

  if (started) {
    return <Badge variant="warning">In progress</Badge>;
  }

  return <Badge variant="slate">Not started</Badge>;
}
