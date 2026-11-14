"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/app/ui";

const DISMISSED_KEY = "veritas-install-prompt-dismissed";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function usesIosInstallInstructions() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    }

    function handleAppInstalled() {
      window.localStorage.setItem(DISMISSED_KEY, "installed");
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const revealTimer = window.setTimeout(() => {
      if (!window.localStorage.getItem(DISMISSED_KEY)) setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "dismissed");
    setVisible(false);
  }

  async function install() {
    if (!installEvent) {
      setShowInstructions(true);
      return;
    }

    try {
      const promptEvent = installEvent;
      setInstallEvent(null);
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        window.localStorage.setItem(DISMISSED_KEY, "installed");
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      setShowInstructions(true);
    }
  }

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg" aria-live="polite">
      <Card className="flex items-start gap-4 p-4 shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {showInstructions ? "Install Veritas" : "Get Veritas on your device"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {showInstructions
              ? usesIosInstallInstructions()
                ? "In Safari, tap Share, then choose Add to Home Screen."
                : "Open your browser menu and choose Install app or Add to Home screen."
              : "Install Veritas for quick access from your home screen or desktop."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {showInstructions ? (
              <Button size="sm" onClick={dismiss}>
                Got it
              </Button>
            ) : (
              <Button size="sm" onClick={install}>
                {installEvent ? "Install Veritas" : "How to install"}
              </Button>
            )}
            {!showInstructions ? (
              <Button variant="secondary" size="sm" onClick={dismiss}>
                Not now
              </Button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          ×
        </button>
      </Card>
    </aside>
  );
}
