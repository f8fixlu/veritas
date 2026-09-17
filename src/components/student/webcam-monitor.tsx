"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<{ name: string; blob: Blob }[]>([]);
  const uploadedRef = useRef(0);
  const startedRef = useRef(false);
  const stoppedRef = useRef(false);
  const readyRef = useRef(false);

  const supported =
    typeof navigator === "undefined" ||
    Boolean(navigator.mediaDevices?.getUserMedia);

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

  const startRequest = useCallback(
    async (silent: boolean) => {
      if (!supported || stoppedRef.current) return;
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
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setStatus("granted");
        setLive(true);
        markReady();

        // Tell the server the camera is live so the admin report reflects it
        // before the first snapshot lands.
        void fetch(`/api/attempts/${attemptIdRef.current}/camera`, {
          method: "POST",
        })
          .then((res) => {
            if (res.status === 409) stoppedRef.current = true;
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
    [markReady, supported]
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
            <div className="mt-6 flex flex-col items-stretch gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={status === "requesting"}
                onClick={() => void startRequest(false)}
              >
                {status === "requesting"
                  ? "Waiting for permission…"
                  : "Enable camera"}
              </button>
              {!supported ? (
                <p className="text-xs text-slate-400">
                  This browser can&apos;t access a webcam. Please contact your
                  instructor.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {status === "granted" ? (
        <div className="no-print fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-md backdrop-blur">
          <video
            ref={previewRef}
            muted
            playsInline
            aria-hidden="true"
            className={`h-10 w-14 rounded-md bg-slate-800 object-cover ${
              live ? "" : "opacity-40"
            }`}
            style={{ transform: "scaleX(-1)" }}
          />
          <span className="flex items-center gap-1.5">
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