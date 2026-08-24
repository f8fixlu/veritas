"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PasswordModal from "./password-modal";

export default function UserMenu({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
          {initials}
        </span>
        <span className="hidden max-w-36 truncate md:block">{user.name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              setModalOpen(true);
            }}
          >
            Change password
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            onClick={signOut}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}

      {modalOpen ? (
        <PasswordModal onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
}
