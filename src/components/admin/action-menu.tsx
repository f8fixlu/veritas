"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { IconMoreVertical } from "@/components/icons";

/**
 * A `⋮` popover that holds a row's (or header's) actions.
 *
 * Children are always mounted and the panel is only hidden with CSS when
 * closed. That matters because the action components inside (`DeleteButton`,
 * `PublishToggle`, the edit buttons…) render their modals through a portal to
 * `document.body`: unmounting the children would tear an open modal down the
 * moment the pointer left the menu. Keeping them mounted also keeps inline
 * action errors visible, since the menu only closes on an outside click or
 * Escape.
 */
export default function ActionMenu({
  children,
  label = "Actions",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        onClick={() => setOpen((o) => !o)}
      >
        <IconMoreVertical />
      </button>
      <div
        role="menu"
        className={`absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
          open ? "" : "hidden"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
