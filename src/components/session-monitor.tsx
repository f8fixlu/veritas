"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 10_000;
const DISMISSED_KEY = "veritas_evicted_dismissed";
const AUTH_PATHS = ["/login", "/register", "/verify", "/verify-required"];

type SessionState =
  | { authenticated: true; role: string }
  | { authenticated: false; evicted: boolean };

/**
 * Mounted in the root layout. Polls the session endpoint and, as soon as it
 * detects that the current cookie was revoked by a sign-in on another device,
 * shows a modal on whichever page the user is on (not a redirect to /login).
 */
export default function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;

    if (pathname && AUTH_PATHS.includes(pathname)) return;

    async function check() {
      if (!active) return;
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const state: SessionState = await res.json();
        if (state.authenticated) {
          sessionStorage.removeItem(DISMISSED_KEY);
          return;
        }
        if (state.evicted) {
          const dismissed = sessionStorage.getItem(DISMISSED_KEY) === "1";
          if (!dismissed) setShow(true);
        }
      } catch {
        // transient network error — retry on the next tick
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Signed out on another device"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl">
          !
        </span>
        <h2 className="text-lg font-semibold text-slate-900">
          Signed in on another device
        </h2>
        <p className="text-sm text-slate-600">
          Your account was signed in on another browser or device. For security,
          this device was signed out. Please sign in again to continue.
        </p>
        <div className="flex justify-center gap-3 pt-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={dismiss}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => router.push("/login")}
          >
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}