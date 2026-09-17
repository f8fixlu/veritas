"use client";

import { useState } from "react";
import AttemptReviewModal from "@/components/attempt-review-modal";

export default function AttemptPhotosButton({
  attemptId,
}: {
  attemptId: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
      >
        View
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