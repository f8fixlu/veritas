"use client";

import { useState } from "react";
import AttemptReviewModal from "@/components/attempt-review-modal";

export default function AttemptResultButton({
  attemptId,
  menuItem = false,
}: {
  attemptId: number;
  menuItem?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={menuItem ? "menu-item" : "btn btn-primary btn-sm"}
        onClick={() => setOpen(true)}
      >
        {menuItem ? "View result" : "Result"}
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
