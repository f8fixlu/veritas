"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/app/ui";
import { cameraErrorMessage } from "@/lib/camera";

/**
 * Shown when the browser blocks a media permission the exam needs (camera or
 * screen sharing). Denying a permission is per-browser and can't be
 * re-triggered by calling getUserMedia/getDisplayMedia again, so the only fix
 * is changing the site permission — which differs between desktop and mobile
 * browsers. This modal walks the student through their specific browser, then
 * lets them retry or reload.
 *
 * Rendered through a portal so it sits above the in-exam gates and works with
 * mobile browsers (scrolls inside the viewport, respects safe areas).
 */

export type MediaPermissionKind = "camera" | "screen";

type BrowserGuide = {
  label: string;
  steps: string[];
  note?: string;
};

type GuideKey =
  | "ios"
  | "android"
  | "edge"
  | "firefox"
  | "chrome"
  | "safari"
  | "generic";

const SCREEN_UNSUPPORTED_MOBILE: BrowserGuide = {
  label: "Phone / tablet",
  steps: [
    "Screen sharing isn't available in mobile browsers.",
    "Open this exam on a desktop or laptop (Chrome, Edge, Firefox or Safari) to continue.",
  ],
  note: "The screen has to be shared for the whole exam, so phones and tablets can't be used.",
};

const GUIDES: Record<MediaPermissionKind, Record<GuideKey, BrowserGuide>> = {
  camera: {
    generic: {
      label: "Your browser",
      steps: [
        "Open your browser's site settings for this page (usually the lock or tune icon next to the address bar).",
        "Set Camera to Allow.",
        "Reload this page, then tap Try again.",
      ],
    },
    ios: {
      label: "iPhone / iPad",
      steps: [
        "Open the Settings app.",
        "Scroll down and tap Safari (or Chrome if that's the browser you're using).",
        "Tap Camera and choose Allow.",
        "Come back to this page and tap Try again.",
      ],
      note: "If this page opened inside another app (Messenger, Instagram, Facebook…), open it in Safari or Chrome first — in-app browsers can't use the camera.",
    },
    android: {
      label: "Android",
      steps: [
        "Tap the lock (or tune) icon next to the address bar.",
        "Tap Permissions, then Camera, then Allow.",
        "Reload this page, then tap Try again.",
      ],
      note: "On some phones, also check Settings → Apps → your browser → Permissions → Camera.",
    },
    edge: {
      label: "Microsoft Edge",
      steps: [
        "Click the lock icon in the address bar.",
        "Open Permissions for this site, then set Camera to Allow.",
        "Reload this page, then click Try again.",
      ],
    },
    firefox: {
      label: "Firefox",
      steps: [
        "Click the lock icon in the address bar.",
        "Choose Clear permission (or remove the blocked camera permission).",
        "Reload this page, choose Allow when asked, then click Try again.",
      ],
    },
    chrome: {
      label: "Chrome",
      steps: [
        "Click the camera (or tune) icon next to the address bar.",
        "Set Camera to Allow.",
        "Reload this page, then click Try again.",
      ],
      note: "You can also open chrome://settings/content/camera and allow this site.",
    },
    safari: {
      label: "Safari",
      steps: [
        "Open Safari → Settings → Websites.",
        "Select Camera and set this website to Allow.",
        "Reload this page, then click Try again.",
      ],
    },
  },
  screen: {
    generic: {
      label: "Your browser",
      steps: [
        "Open your browser's site settings for this page (usually the lock or tune icon next to the address bar).",
        "Allow screen sharing for this site.",
        "Reload this page, tap Try again, then choose Entire screen in the sharing picker.",
      ],
      note: "Sharing a window or browser tab is not accepted and ends the exam session.",
    },
    ios: SCREEN_UNSUPPORTED_MOBILE,
    android: SCREEN_UNSUPPORTED_MOBILE,
    edge: {
      label: "Microsoft Edge",
      steps: [
        "Click Try again, then choose Entire screen in the sharing picker.",
        "Select your screen and click Share.",
        "If the picker doesn't appear, click the lock icon in the address bar, allow screen capture for this site, then reload this page.",
      ],
      note: "Sharing a window or browser tab is not accepted and ends the exam session.",
    },
    firefox: {
      label: "Firefox",
      steps: [
        "Click Try again, then choose Entire Screen in the sharing picker.",
        "Select your screen and click Allow.",
        "If the picker never appears, reload this page and choose Entire Screen again.",
      ],
      note: "Firefox asks for screen sharing every time; pick Entire Screen, not a window or tab.",
    },
    chrome: {
      label: "Chrome",
      steps: [
        "Click Try again, then open the Entire screen tab in the sharing picker.",
        "Select your screen and click Share.",
        "If the picker doesn't appear, click the tune icon next to the address bar and allow screen capture for this site, then reload this page.",
      ],
      note: "You can also open chrome://settings/content and check this site's screen sharing permission.",
    },
    safari: {
      label: "Safari",
      steps: [
        "Click Try again, then choose Entire Screen and click Allow.",
        "If the picker never appears, open System Settings → Privacy & Security → Screen Recording and enable your browser.",
        "Quit and reopen the browser, then reload this page.",
      ],
      note: "Safari can only share the whole screen; sharing a window or tab is not accepted.",
    },
  },
};

function detectGuideKey(): GuideKey {
  if (typeof navigator === "undefined") return "generic";

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);
  const isFirefox = /Firefox\/|FxiOS/.test(ua);
  const isChrome =
    /Chrome\/|CriOS/.test(ua) && !isEdge && !isOpera && !isFirefox;
  const isSafari =
    /Safari\//.test(ua) &&
    !isChrome &&
    !isEdge &&
    !isOpera &&
    !isFirefox &&
    !/CriOS|FxiOS|EdgiOS/.test(ua);

  if (isIOS) return "ios";
  if (isAndroid) return "android";
  if (isEdge) return "edge";
  if (isFirefox) return "firefox";
  if (isChrome) return "chrome";
  if (isSafari) return "safari";
  return "generic";
}

const TITLES: Record<MediaPermissionKind, string> = {
  camera: "Enable your camera",
  screen: "Enable screen sharing",
};

const DEFAULT_MESSAGES: Record<MediaPermissionKind, string> = {
  camera:
    "Camera access was denied. Allow camera access for this site to continue.",
  screen:
    "Screen sharing was denied. Allow screen sharing for this site and choose Entire screen to continue.",
};

const FOOTNOTES: Record<MediaPermissionKind, string> = {
  camera:
    "The camera only works over HTTPS (or on localhost). If the permission prompt doesn't appear, reload the page after allowing it.",
  screen:
    "Screen sharing only works over HTTPS (or on localhost). If the sharing picker doesn't appear, reload the page after allowing it.",
};

function MediaIcon({ kind }: { kind: MediaPermissionKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {kind === "camera" ? (
        <path d="M23 7l-7 5 7 5V7z" />
      ) : (
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M8 21H5a2 2 0 0 1-2-2v-3M21 16v3a2 2 0 0 1-2 2h-3" />
      )}
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function MediaPermissionModal({
  kind,
  message,
  onRetry,
  onClose,
}: {
  kind: MediaPermissionKind;
  /** Overrides the default denial message for this permission. */
  message?: string;
  /** Returns an error message when the permission still can't be granted, or null on success. */
  onRetry: () => Promise<string | null>;
  onClose: () => void;
}) {
  const guide = useMemo(() => GUIDES[kind][detectGuideKey()], [kind]);
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, busy]);

  async function retry() {
    setBusy(true);
    setRetryError(null);
    try {
      const error = await onRetry();
      if (error) {
        setRetryError(error);
        return;
      }
      onClose();
    } catch (err) {
      setRetryError(
        kind === "camera"
          ? cameraErrorMessage(err)
          : "Could not start screen sharing. Choose Entire screen and allow sharing to continue."
      );
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-permission-title"
          className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-6 shadow-xl supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <MediaIcon kind={kind} />
          </div>

          <h2
            id="media-permission-title"
            className="text-center text-lg font-semibold tracking-tight text-slate-900"
          >
            {TITLES[kind]}
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            {message ?? DEFAULT_MESSAGES[kind]}
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              How to allow it in {guide.label}
            </p>
            <ol className="mt-3 space-y-2.5">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {index + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            {guide.note ? (
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
                {guide.note}
              </p>
            ) : null}
          </div>

          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            {FOOTNOTES[kind]}
          </p>

          {retryError ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {retryError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void retry()}>
              {busy ? "Checking access…" : "Try again"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
