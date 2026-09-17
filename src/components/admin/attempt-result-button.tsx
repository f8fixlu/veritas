"use client";

import { useState } from "react";
import AttemptReviewModal from "@/components/attempt-review-modal";

export default function AttemptResultButton({
  attemptId,
}: {
  attemptId: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => setOpen(true)}
      >
        Result
      </button>
      {open ? (
        <AttemptReviewModal
          attemptId={attemptId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}