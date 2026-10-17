"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/search";

/**
 * Searchable subject filter: an editable input backed by a datalist of the
 * instructor's subject names. Typing narrows the dropdown (native datalist
 * behaviour) and debounces a server-side `?q=` filter; picking a name from the
 * dropdown applies that name as the query.
 */
export default function SubjectsSearch({ subjects }: { subjects: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
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
    // Nothing changed vs the URL — skip the redundant navigation.
    if (term === initial) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set("q", term);
      else params.delete("q");
      params.delete("page");
      router.push(`?${params.toString()}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="w-full sm:w-56">
      <label
        htmlFor="subjects-search"
        className="block text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        Search subjects
      </label>
      <div className="relative mt-1">
        <input
          type="text"
          id="subjects-search"
          className="input pr-9"
          placeholder="Type or pick a subject..."
          autoComplete="off"
          list="subjects-search-datalist"
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
            aria-label="Clear subject search"
          >
            ×
          </button>
        ) : null}
      </div>
      <datalist id="subjects-search-datalist">
        {subjects.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
