"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cameraErrorMessage } from "@/lib/camera";

export default function StartExamButton({
  examId,
  label = "Start exam",
  requireCamera = false,
}: {
  examId: number;
  label?: string;
  requireCamera?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Acquire the camera before creating the attempt so the exam (and its clock)
  // only starts once the student's webcam is actually available. The stream is
  // released immediately; the in-exam monitor re-acquires it (permission is
  // already granted, so it starts instantly).
  async function preflightCamera(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't access a webcam, which this exam requires.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 960 },
          height: { ideal: 480, max: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      setError(cameraErrorMessage(err));
      return false;
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            let cameraAttested = false;
            if (requireCamera) {
              const ok = await preflightCamera();
              if (!ok) return;
              cameraAttested = true;
            }
            const res = await fetch(`/api/exams/${examId}/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cameraAttested }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(data.error ?? "Could not start the exam.");
              return;
            }
            router.push(
              data.ended ? `/result/${data.attemptId}` : `/attempt/${data.attemptId}`
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && requireCamera ? "Checking camera…" : busy ? "Preparing…" : label}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
