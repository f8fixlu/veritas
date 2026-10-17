"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/search";

export default function ReportSearch({
  param,
  basePath,
}: {
  param: string;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get(param) ?? "";
  const [term, setTerm] = useState(initial);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    // Mirror the URL query into the box when it changes externally
    // (back/forward, navigation), but never while the user is typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTerm((prev) => (prev === initial ? prev : initial));
  }, [initial, focused, param]);

  useEffect(() => {
    // Nothing typed/changed vs the URL — don't navigate. Without this guard
    // every push produces a new searchParams object, re-running this effect
    // and re-pushing forever (constant background RSC requests).
    if (term === initial) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set(param, term);
      else params.delete(param);
      if (param === "lq") params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, initial, searchParams, router, param, basePath]);

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
