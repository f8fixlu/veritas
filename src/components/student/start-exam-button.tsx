"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MediaPermissionModal from "@/components/media-permission-modal";
import {
  cameraErrorMessage,
  isCameraPermissionError,
} from "@/lib/camera";
import { Button } from "@/app/ui";

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640, max: 960 },
    height: { ideal: 480, max: 720 },
    facingMode: "user",
  },
  audio: false,
};

type CameraAttempt = { error: string; permission: boolean } | null;

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
  const [cameraModal, setCameraModal] = useState(false);

  // One attempt at the camera. Returns null on success, otherwise the
  // student-facing message plus whether it was a permission block (the only
  // case the enable-camera modal can help with).
  async function tryCamera(): Promise<CameraAttempt> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        error: "This browser can't access a webcam, which this assessment requires.",
        permission: false,
      };
    }
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      stream.getTracks().forEach((t) => t.stop());
      return null;
    } catch (err) {
      return {
        error: cameraErrorMessage(err),
        permission: isCameraPermissionError(err),
      };
    }
  }

  // Acquire the camera before creating the attempt so the exam (and its clock)
  // only starts once the student's webcam is actually available. The stream is
  // released immediately; the in-exam monitor re-acquires it (permission is
  // already granted, so it starts instantly).
  async function preflightCamera(): Promise<boolean> {
    const result = await tryCamera();
    if (!result) {
      setError(null);
      return true;
    }
    setError(result.error);
    if (result.permission) setCameraModal(true);
    return false;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="primary"
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
            // Screen sharing is requested once, inside the attempt itself (the
            // browser re-prompts for getDisplayMedia every time, so preflighting
            // here would just make the student pick a screen twice). The exam
            // runner holds the clock and blocks save/submit until the screen is
            // actually shared.
            const res = await fetch(`/api/exams/${examId}/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cameraAttested }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(data.error ?? "Could not start the assessment.");
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
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {cameraModal ? (
        <MediaPermissionModal
          kind="camera"
          message={error ?? undefined}
          onClose={() => setCameraModal(false)}
          onRetry={async () => {
            const result = await tryCamera();
            if (!result) {
              setError(null);
              return null;
            }
            setError(result.error);
            return result.error;
          }}
        />
      ) : null}
    </div>
  );
}
