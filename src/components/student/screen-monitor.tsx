"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CAPTURE_INTERVAL_MS = 10_000;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH = 6;
const MAX_PENDING = 12;
// A shared screen is far more detailed than a webcam frame, so keep the encoded
// size comfortably under the server's per-file cap (SNAPSHOT_MAX_BYTES, 512 KB).
const MAX_CAPTURE_WIDTH = 1024;
const JPEG_QUALITY = 0.55;
const MAX_CAPTURE_BYTES = 480 * 1024;

export default function ScreenMonitor({
  attemptId,
  requireScreenCapture,
  onScreenReady,
}: {
  attemptId: number;
  requireScreenCapture: boolean;
  onScreenReady: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<{ name: string; blob: Blob }[]>([]);
  const stoppedRef = useRef(false);
  const readyRef = useRef(false);

  const stopAndReload = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.location.reload();
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || status === "requesting") return;
    // Reset on every (re)start: React StrictMode replays effects on mount in
    // development, which flips `stoppedRef` on and would otherwise leave the
    // gate stuck on "Requesting access…" forever.
    stoppedRef.current = false;
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // "monitor" is only a hint: the browser still offers Window/Tab in its
        // picker, so the actual choice is verified below and non-screens rejected.
        video: { displaySurface: "monitor" },
        audio: false,
        // Chromium-only options; ignored by browsers that don't support them.
        surfaceSwitching: "exclude",
        selfBrowserSurface: "exclude",
      } as DisplayMediaStreamOptions);
      if (stoppedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("No display track");
      const surface = track.getSettings().displaySurface;
      if (surface && surface !== "monitor") {
        stream.getTracks().forEach((t) => t.stop());
        setStatus("denied");
        setError("Please share your entire screen. Sharing a window or browser tab is not accepted.");
        return;
      }
      track.addEventListener("ended", stopAndReload);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const res = await fetch(`/api/attempts/${attemptId}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: surface ?? null }),
      });
      if (!res.ok) throw new Error("Could not verify screen sharing");
      setStatus("granted");
      readyRef.current = true;
      onScreenReady();
    } catch {
      setStatus("denied");
      setError("Screen sharing is required. Choose a screen or tab and allow sharing to continue.");
    }
  }, [attemptId, onScreenReady, status, stopAndReload]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !streamRef.current) return;
    // Safety net for browsers that allow switching surfaces mid-session: if the
    // shared surface is no longer the whole screen, reload back to the gate.
    const surface = streamRef.current.getVideoTracks()[0]?.getSettings().displaySurface;
    if (surface && surface !== "monitor") {
      stopAndReload();
      return;
    }
    const width = Math.min(video.videoWidth, MAX_CAPTURE_WIDTH);
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob || stoppedRef.current) return;
      // Drop a frame that still exceeds the server cap: sending it would be
      // rejected silently (or, for a whole batch, trigger endless retries).
      if (blob.size > MAX_CAPTURE_BYTES) return;
      pendingRef.current.push({ name: `${Date.now()}.jpg`, blob });
      if (pendingRef.current.length > MAX_PENDING) pendingRef.current.splice(0, pendingRef.current.length - MAX_PENDING);
    }, "image/jpeg", JPEG_QUALITY);
  }, [stopAndReload]);

  const flush = useCallback(async () => {
    if (stoppedRef.current || pendingRef.current.length === 0) return;
    const batch = pendingRef.current.splice(0, MAX_BATCH);
    const form = new FormData();
    form.append("source", "SCREEN");
    for (const item of batch) form.append("file", item.blob, item.name);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/snapshots`, { method: "POST", body: form });
      if (!res.ok) pendingRef.current.unshift(...batch);
    } catch {
      pendingRef.current.unshift(...batch);
    }
  }, [attemptId]);

  useEffect(() => {
    if (status !== "granted") return;
    capture();
    const captureTimer = window.setInterval(capture, CAPTURE_INTERVAL_MS);
    const flushTimer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => {
      window.clearInterval(captureTimer);
      window.clearInterval(flushTimer);
    };
  }, [capture, flush, status]);

  useEffect(() => () => {
    // Flush before flipping the stop flag — `flush()` bails out when stopped,
    // so doing it the other way around silently dropped the last batch on submit.
    void flush();
    stoppedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [flush]);

  if (!requireScreenCapture) return null;
  return <>
    <video ref={videoRef} className="hidden" muted playsInline aria-hidden="true" />
    {status !== "granted" ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-6 text-center"><div className="max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl"><h2 className="text-lg font-semibold text-white">Screen sharing required</h2><p className="mt-2 text-sm leading-relaxed text-slate-300">Share your screen to continue. A screen snapshot is taken every 10 seconds while you work.</p>{error ? <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p> : null}<button type="button" className="btn btn-primary mt-6" onClick={() => void start()} disabled={status === "requesting"}>{status === "requesting" ? "Requesting access…" : "Start screen sharing"}</button></div></div> : null}
  </>;
}
