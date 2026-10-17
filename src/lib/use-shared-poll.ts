"use client";

import { useEffect, useRef } from "react";

type Listener = (data: unknown) => void;

type PollEntry = {
  listeners: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
  last: unknown;
  onVisible: () => void;
};

/**
 * Module-level registry of in-flight polls, keyed by request URL. Multiple
 * components watching the same endpoint share one interval and one request per
 * tick instead of each firing their own — e.g. every "not started" roster row
 * watching `/exams/:id/status` now costs a single request, not one per row.
 */
const polls = new Map<string, PollEntry>();

function tick(entry: PollEntry, url: string) {
  if (entry.inFlight) return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  entry.inFlight = true;
  fetch(url, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data === null) return;
      entry.last = data;
      for (const listener of entry.listeners) listener(data);
    })
    .catch(() => {
      // transient network hiccup — retry on the next tick
    })
    .finally(() => {
      entry.inFlight = false;
    });
}

function acquire(url: string, intervalMs: number): PollEntry {
  const existing = polls.get(url);
  if (existing) return existing;

  const entry: PollEntry = {
    listeners: new Set(),
    timer: null,
    inFlight: false,
    last: null,
    onVisible: () => tick(entry, url),
  };
  polls.set(url, entry);
  entry.timer = setInterval(() => tick(entry, url), intervalMs);
  document.addEventListener("visibilitychange", entry.onVisible);
  window.addEventListener("focus", entry.onVisible);
  tick(entry, url);
  return entry;
}

function release(url: string, listener: Listener) {
  const entry = polls.get(url);
  if (!entry) return;
  entry.listeners.delete(listener);
  if (entry.listeners.size > 0) return;
  if (entry.timer) clearInterval(entry.timer);
  document.removeEventListener("visibilitychange", entry.onVisible);
  window.removeEventListener("focus", entry.onVisible);
  polls.delete(url);
}

/**
 * Subscribe to a JSON endpoint refreshed every `intervalMs`. All subscribers of
 * the same `url` share one poll. Passing an empty `url` pauses the
 * subscription (used to stop watching once an attempt is over).
 */
export function useSharedPoll<T>(
  url: string,
  intervalMs: number,
  onData: (data: T) => void
): void {
  const handlerRef = useRef(onData);

  useEffect(() => {
    handlerRef.current = onData;
  });

  useEffect(() => {
    if (!url) return;
    const listener: Listener = (data) => handlerRef.current(data as T);
    const entry = acquire(url, intervalMs);
    entry.listeners.add(listener);
    if (entry.last !== null) listener(entry.last);
    return () => release(url, listener);
  }, [url, intervalMs]);
}
