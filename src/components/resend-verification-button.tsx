"use client";

import { useState } from "react";

export default function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not resend.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not resend. Try again.");
      setState("idle");
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={state === "sending"}
        onClick={() => void resend()}
      >
        {state === "sending"
          ? "Sending…"
          : state === "sent"
            ? "Email sent"
            : "Resend verification email"}
      </button>
    </div>
  );
}
