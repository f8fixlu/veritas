"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@/app/ui";

const POLL_MS = 10_000;
const DISMISSED_KEY = "veritas_evicted_dismissed";
const AUTH_PATHS = ["/login", "/register", "/verify", "/verify-required"];
/** How long the modal waits for a decision before closing itself. */
const AUTO_CLOSE_SECONDS = 60;

type SessionState =
  | { authenticated: true; role: string }
  | { authenticated: false; evicted: boolean };

/**
 * Counts down while mounted, then asks the parent to close the modal. Kept as a
 * child so the timer restarts every time the modal is shown.
 */
function AutoCloseCountdown({ onExpire }: { onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    const deadline = Date.now() + AUTO_CLOSE_SECONDS * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [onExpire]);

  return (
    <p className="text-xs tabular-nums text-slate-500">
      This message closes automatically in {secondsLeft}s.
    </p>
  );
}

/**
 * Mounted in the root layout. Polls the session endpoint and, as soon as it
 * detects that the current cookie was revoked by a sign-in on another device,
 * shows a modal on whichever page the user is on (not a redirect to /login).
 */
export default function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const onAuthPage = Boolean(pathname && AUTH_PATHS.includes(pathname));

  // The countdown expired: stop re-showing the modal, then refresh so the
  // server can redirect to the login page for this (revoked) session.
  const expire = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    let active = true;

    // The modal must never cover the login/register forms. On auth pages it is
    // hidden by the render guard below, and there is no session to poll.
    if (onAuthPage) return;

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
          // A sign-in in another tab restores this cookie; drop the modal.
          setShow(false);
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
  }, [onAuthPage]);

  if (!show || onAuthPage) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Signed out on another device"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
    >
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
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
        <AutoCloseCountdown onExpire={expire} />
        <div className="flex justify-center pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShow(false);
              router.push("/login");
            }}
          >
            Sign in again
          </Button>
        </div>
      </Card>
    </div>
  );
}