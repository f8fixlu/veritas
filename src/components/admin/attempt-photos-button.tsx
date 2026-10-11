"use client";

import { useState } from "react";
import AttemptSnapshotsModal from "@/components/admin/attempt-snapshots-modal";

export default function AttemptPhotosButton({
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
        className={menuItem ? "menu-item" : "btn btn-secondary btn-sm"}
        onClick={() => setOpen(true)}
      >
        {menuItem ? "View photos" : "View"}
      </button>
      {open ? (
        <AttemptSnapshotsModal
          attemptId={attemptId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
