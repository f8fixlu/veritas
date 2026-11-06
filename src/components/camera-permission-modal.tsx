"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/app/ui";
import { cameraErrorMessage } from "@/lib/camera";

/**
 * Shown when the browser blocks camera access (NotAllowedError / dismissed
 * prompt). Denying a camera prompt is per-browser and can't be re-triggered by
 * calling getUserMedia again, so the only fix is changing the site permission
 * — which differs between desktop and mobile browsers. This modal walks the
 * student through their specific browser, then lets them retry or reload.
 *
 * Rendered through a portal so it sits above the in-exam gate and works with
 * mobile browsers (scrolls inside the viewport, respects safe areas).
 */

type BrowserGuide = {
  label: string;
  steps: string[];
  note?: string;
};

const GENERIC_GUIDE: BrowserGuide = {
  label: "Your browser",
  steps: [
    "Open your browser's site settings for this page (usually the lock or tune icon next to the address bar).",
    "Set Camera to Allow.",
    "Reload this page, then tap Try again.",
  ],
};

function detectGuide(): BrowserGuide {
  if (typeof navigator === "undefined") return GENERIC_GUIDE;

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

  if (isIOS) {
    return {
      label: "iPhone / iPad",
      steps: [
        "Open the Settings app.",
        "Scroll down and tap Safari (or Chrome if that's the browser you're using).",
        "Tap Camera and choose Allow.",
        "Come back to this page and tap Try again.",
      ],
      note: "If this page opened inside another app (Messenger, Instagram, Facebook…), open it in Safari or Chrome first — in-app browsers can't use the camera.",
    };
  }

  if (isAndroid) {
    return {
      label: "Android",
      steps: [
        "Tap the lock (or tune) icon next to the address bar.",
        "Tap Permissions, then Camera, then Allow.",
        "Reload this page, then tap Try again.",
      ],
      note: "On some phones, also check Settings → Apps → your browser → Permissions → Camera.",
    };
  }

  if (isEdge) {
    return {
      label: "Microsoft Edge",
      steps: [
        "Click the lock icon in the address bar.",
        "Open Permissions for this site, then set Camera to Allow.",
        "Reload this page, then click Try again.",
      ],
    };
  }

  if (isFirefox) {
    return {
      label: "Firefox",
      steps: [
        "Click the lock icon in the address bar.",
        "Choose Clear permission (or remove the blocked camera permission).",
        "Reload this page, choose Allow when asked, then click Try again.",
      ],
    };
  }

  if (isChrome) {
    return {
      label: "Chrome",
      steps: [
        "Click the camera (or tune) icon next to the address bar.",
        "Set Camera to Allow.",
        "Reload this page, then click Try again.",
      ],
      note: "You can also open chrome://settings/content/camera and allow this site.",
    };
  }

  if (isSafari) {
    return {
      label: "Safari",
      steps: [
        "Open Safari → Settings → Websites.",
        "Select Camera and set this website to Allow.",
        "Reload this page, then click Try again.",
      ],
    };
  }

  return GENERIC_GUIDE;
}

export default function CameraPermissionModal({
  message = "Camera access was denied. Allow camera access for this site to continue.",
  onRetry,
  onClose,
}: {
  message?: string;
  /** Returns an error message when the camera still can't start, or null on success. */
  onRetry: () => Promise<string | null>;
  onClose: () => void;
}) {
  const guide = useMemo(() => detectGuide(), []);
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
      setRetryError(cameraErrorMessage(err));
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
          aria-labelledby="camera-permission-title"
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
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              <path d="m2 2 20 20" />
            </svg>
          </div>

          <h2
            id="camera-permission-title"
            className="text-center text-lg font-semibold tracking-tight text-slate-900"
          >
            Enable your camera
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            {message}
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
            The camera only works over HTTPS (or on localhost). If the permission
            prompt doesn&apos;t appear, reload the page after allowing it.
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
              {busy ? "Checking camera…" : "Try again"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
