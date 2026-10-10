"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Webcam proctoring for a live attempt:
 *  - Requests camera access, shows a blocking gate while the exam requires a
 *    camera and permission hasn't been granted.
 *  - Captures a downscaled JPEG every ~10s and batches them up to the
 *    `/api/attempts/<id>/snapshots` endpoint.
 *  - Captures immediately when the window regains focus, so a tab-switch gap
 *    (which anti-cheat already flags) leaves a visible photo gap for admins.
 */

const CAPTURE_INTERVAL_MS = 10_000;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH = 6;
const MAX_PENDING = 12;
const JPEG_QUALITY = 0.62;

type CameraStatus = "idle" | "requesting" | "granted" | "denied";

// True when the browser exposes getUserMedia. Read via useSyncExternalStore so
// there is no setState-in-effect: it returns the SSR-safe default during
// hydration and the real value on the client (re-rendering if they differ).
function useCameraSupport(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator === "undefined"
        ? true
        : Boolean(navigator.mediaDevices?.getUserMedia),
    () => true
  );
}

export default function WebcamMonitor({
  attemptId,
  requireCamera,
  onCameraReady,
}: {
  attemptId: number;
  requireCamera: boolean;
  onCameraReady: () => void;
}) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [deniedReason, setDeniedReason] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [live, setLive] = useState(false);
  const [virtualCamera, setVirtualCamera] = useState(false);
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const supported = useCameraSupport();

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const pipDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<{ name: string; blob: Blob }[]>([]);
  const uploadedRef = useRef(0);
  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const readyRef = useRef(false);
  const reloadingRef = useRef(false);

  // Camera toggled on/off? Reload the page so the exam re-evaluates the new
  // state (gate, autosave/submit blocks). Guarded so the several signals that
  // can fire for one toggle (devicechange, track ended) trigger a single reload.
  const reloadPage = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    window.location.reload();
  }, []);

  // Keep the draggable camera preview inside the viewport.
  const clampPip = useCallback((x: number, y: number) => {
    const el = pipRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(x, 0), Math.max(0, window.innerWidth - w)),
      y: Math.min(Math.max(y, 0), Math.max(0, window.innerHeight - h)),
    };
  }, []);

  const onPipPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = pipRef.current;
      if (!el) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      pipDragRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      el.setPointerCapture(e.pointerId);
    },
    []
  );

  const onPipPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = pipDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setPipPos(clampPip(e.clientX - drag.offsetX, e.clientY - drag.offsetY));
    },
    [clampPip]
  );

  const onPipPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = pipDragRef.current;
      const el = pipRef.current;
      if (drag && drag.pointerId === e.pointerId && el) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          // capture already released
        }
      }
      pipDragRef.current = null;
    },
    []
  );

  // Re-clamp after a resize / fullscreen change so the preview can't drift off.
  const pipDetached = pipPos !== null;
  useEffect(() => {
    if (!pipDetached) return;
    const onResize = () => setPipPos((p) => (p ? clampPip(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pipDetached, clampPip]);

  // Keep the latest props in refs (updated after each commit) so the capture /
  // flush callbacks stay stable across the parent's frequent re-renders while
  // still seeing fresh values.
  const attemptIdRef = useRef(attemptId);
  const onCameraReadyRef = useRef(onCameraReady);
  useEffect(() => {
    attemptIdRef.current = attemptId;
    onCameraReadyRef.current = onCameraReady;
  });

  useEffect(() => {
    if (status !== "granted" || !previewRef.current || !streamRef.current) return;
    try {
      previewRef.current.srcObject = streamRef.current;
    } catch {
      // stream already released
    }
  }, [status, streamRef]);

  const markReady = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onCameraReadyRef.current();
    }
  }, []);

  // Fires when a camera device is plugged in, unplugged, enabled or disabled.
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    media.addEventListener("devicechange", reloadPage);
    return () => media.removeEventListener("devicechange", reloadPage);
  }, [reloadPage]);

  const startRequest = useCallback(
    async (silent: boolean) => {
      if (!supported) return;
      stoppedRef.current = false;
      if (startedRef.current) return;
      startedRef.current = true;
      if (!silent) setStatus("requesting");
      setDeniedReason(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 960 },
            height: { ideal: 480, max: 720 },
            facingMode: "user",
          },
          audio: false,
        });
        if (stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        stream.getVideoTracks().forEach((t) => {
          t.addEventListener("ended", reloadPage);
          t.addEventListener("unmute", reloadPage);
        });
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setStatus("granted");
        setLive(true);
        markReady();

        // Tell the server the camera is live (with its device label) so the
        // admin report reflects it before the first snapshot lands and can flag
        // known virtual / software cameras (OBS, ManyCam, …).
        const track = stream.getVideoTracks()[0];
        let label = track?.label ?? "";
        if (!label && track) {
          const deviceId = track.getSettings?.().deviceId;
          if (deviceId) {
            const devices = await navigator.mediaDevices
              .enumerateDevices()
              .catch(() => []);
            label =
              devices.find(
                (d) => d.kind === "videoinput" && d.deviceId === deviceId
              )?.label ?? "";
          }
        }
        void fetch(`/api/attempts/${attemptIdRef.current}/camera`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        })
          .then(async (res) => {
            if (res.status === 409) {
              stoppedRef.current = true;
              return;
            }
            const data = await res.json().catch(() => null);
            if (data?.virtualCamera) setVirtualCamera(true);
          })
          .catch(() => {});
      } catch (err) {
        startedRef.current = false;
        setStatus("denied");
        const e = err as { name?: string };
        setDeniedReason(
          e?.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera access for this site to continue."
            : e?.name === "NotFoundError" ||
                e?.name === "OverconstrainedError"
              ? "No camera was found on this device."
              : e?.name === "NotReadableError"
                ? "The camera is in use by another application."
                : !navigator.mediaDevices
                  ? "This browser does not support webcam access."
                  : "Could not start the camera. It works on localhost or HTTPS."
        );
      }
    },
    [markReady, supported, reloadPage]
  );

  // Try to start the camera for every attempt — the "require" flag only
  // decides whether access is blocked (gate) or optional (student may decline).
  useEffect(() => {
    if (!requireCamera || readyRef.current) return;
    void startRequest(false);
  }, [requireCamera, startRequest]);

  useEffect(() => {
    if (requireCamera || readyRef.current || startedRef.current) return;
    void startRequest(true);
  }, [requireCamera, startRequest]);

  // Re-enabling a camera doesn't change the device list, so `devicechange` never
  // fires for it. While the required camera is unavailable, quietly probe for it
  // and reload the page the moment it comes back so the exam re-evaluates.
  useEffect(() => {
    if (!requireCamera || status !== "denied") return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      if (cancelled || readyRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) reloadPage();
      } catch {
        // still unavailable — keep waiting
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [requireCamera, status, reloadPage]);

  // Capture one JPEG frame.
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !streamRef.current) return;
    const scale = Math.min(1, 480 / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob || stoppedRef.current) return;
        pendingRef.current.push({ name: `${Date.now()}.jpg`, blob });
        if (pendingRef.current.length > MAX_PENDING) {
          pendingRef.current.splice(
            0,
            pendingRef.current.length - MAX_PENDING
          );
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  }, []);

  const flush = useCallback(async () => {
    if (stoppedRef.current || pendingRef.current.length === 0) return;
    const batch = pendingRef.current.splice(0, MAX_BATCH);
    try {
      const form = new FormData();
      for (const item of batch) form.append("file", item.blob, item.name);
      const res = await fetch(`/api/attempts/${attemptIdRef.current}/snapshots`, {
        method: "POST",
        body: form,
      });
      if (res.status === 409) {
        stoppedRef.current = true;
        return;
      }
      if (!res.ok) {
        pendingRef.current.unshift(...batch);
        return;
      }
      uploadedRef.current += batch.length;
      setUploaded(uploadedRef.current);
    } catch {
      pendingRef.current.unshift(...batch);
      if (pendingRef.current.length > MAX_PENDING) {
        pendingRef.current.splice(0, pendingRef.current.length - MAX_PENDING);
      }
    }
  }, []);

  useEffect(() => {
    if (status !== "granted") return;
    void capture();
    const captureTimer = setInterval(capture, CAPTURE_INTERVAL_MS);
    const flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const onFocus = () => void capture();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void capture();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("focus", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(captureTimer);
      clearInterval(flushTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("focus", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, capture, flush]);

  // Final best-effort flush + release the camera when leaving the page.
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      void flush();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [flush]);

  const blocked = requireCamera && status !== "granted";

  return (
    <>
      {/* Hidden mirror element — the live feed is only drawn onto the canvas
          for capture frames, never streamed anywhere. */}
      <video
        ref={videoRef}
        className="hidden"
        muted
        playsInline
        aria-hidden="true"
      />

      {blocked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-indigo-300"
                aria-hidden="true"
              >
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Camera required
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              This exam is proctored with webcam snapshots. Snapshots of you are
              taken every 10 seconds while you work and are reviewed by your
              instructor after submission.
            </p>
            {status !== "idle" && status !== "requesting" && deniedReason ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {deniedReason}
              </p>
            ) : null}
            {!supported ? (
              <p className="mt-6 text-xs text-slate-400">
                This browser can&apos;t access a webcam. Please contact your
                instructor.
              </p>
            ) : (
              <p className="mt-6 text-xs text-slate-400">
                Waiting for camera access… Re-enable your camera and the page
                will reload automatically.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {virtualCamera && status === "granted" ? (
        <div className="no-print fixed left-1/2 top-16 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800 shadow-sm">
          A virtual camera was detected. Your snapshots may not show your real
          face — this has been reported to your instructor.
        </div>
      ) : null}

      {status === "granted" ? (
        <div
          ref={pipRef}
          onPointerDown={onPipPointerDown}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
          onPointerCancel={onPipPointerUp}
          className={`no-print fixed z-[9999] flex touch-none cursor-grab select-none items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-md backdrop-blur active:cursor-grabbing ${
            pipPos ? "" : "bottom-20 right-4"
          }`}
          style={pipPos ? { left: pipPos.x, top: pipPos.y } : undefined}
          title="Drag to move"
        >
          <video
            ref={previewRef}
            autoPlay
            muted
            playsInline
            aria-hidden="true"
            className={`pointer-events-none h-10 w-14 rounded-md bg-slate-800 object-cover ${
              live ? "" : "opacity-40"
            }`}
            style={{ transform: "scaleX(-1)" }}
          />
          <span className="pointer-events-none flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                live ? "animate-pulse bg-red-500" : "bg-slate-300"
              }`}
            />
            {uploaded} recorded
          </span>
        </div>
      ) : null}
    </>
  );
}