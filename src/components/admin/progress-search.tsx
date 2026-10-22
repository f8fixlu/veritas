"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/search";

/**
 * Student search for the admin "Test progress" table. Writes the `student`
 * query param (independent of `subject`/`exam`/`status`, which the filters
 * preserve) and resets pagination when the term changes.
 */
export default function ProgressSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("student") ?? "";
  const [term, setTerm] = useState(initial);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    // Mirror the URL query into the box when it changes externally
    // (back/forward, navigation), but never while the user is typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTerm((prev) => (prev === initial ? prev : initial));
  }, [initial, focused]);

  useEffect(() => {
    // Nothing typed/changed vs the URL — don't navigate. Without this guard
    // every push produces a new searchParams object, re-running this effect
    // and re-pushing forever (constant background RSC requests).
    if (term === initial) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set("student", term);
      else params.delete("student");
      params.delete("pendingPage");
      const qs = params.toString();
      router.push(qs ? `/admin?${qs}` : "/admin", { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, initial, searchParams, router]);

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Search student
      </label>
      <div className="relative mt-1">
        <input
          type="text"
          className="input pr-9"
          placeholder="Type to filter students..."
          autoComplete="off"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {term ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-lg leading-none text-slate-400 hover:text-slate-700"
            onClick={() => setTerm("")}
            aria-label="Clear student search"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
