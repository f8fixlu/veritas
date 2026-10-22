"use client";

import { useSyncExternalStore } from "react";

// One interval for the whole page: every component that needs "now" (e.g. an
// attempt's time remaining) subscribes here instead of starting its own timer.
// A roster with 30 in-progress rows therefore costs one tick per second, not 30.
const TICK_MS = 1000;
const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const fn of listeners) fn();
    }, TICK_MS);
    // Let the first subscriber render immediately instead of waiting a tick.
    listener();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Current time in ms, refreshed once per second for every subscriber. */
export function useNow(): number {
  // Server/hydration snapshot is 0 so the first paint is deterministic; the
  // value arrives once the store subscribes on the client.
  return useSyncExternalStore(subscribe, () => current, () => 0);
}

export default useNow;
