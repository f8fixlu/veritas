"use client";

import { useRouter } from "next/navigation";
import React from "react";

/**
 * Searchable subject filter shared by the exam list and the students page.
 * Typing a name matches via datalist and navigates to `${basePath}?subject=<id>`;
 * clearing the field removes the filter and resets pagination.
 */
export default function SubjectFilter({
  subjects,
  selectedId,
  basePath,
  label = "Filter by subject",
}: {
  subjects: { id: number; name: string }[];
  selectedId: number | null;
  basePath: string;
  label?: string;
}) {
  const router = useRouter();

  const selected = selectedId
    ? subjects.find((s) => s.id === selectedId)
    : null;
  const [term, setTerm] = React.useState(selected?.name ?? "");
  const nextTerm = selected?.name ?? "";
  const [syncedTerm, setSyncedTerm] = React.useState(nextTerm);

  if (nextTerm !== syncedTerm) {
    setSyncedTerm(nextTerm);
    setTerm(nextTerm);
  }

  function handleChange(name: string) {
    setTerm(name);
    if (!name) {
      router.push(basePath, { scroll: false });
      return;
    }
    const match = subjects.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (match && match.id !== selectedId) {
      router.push(`${basePath}?subject=${match.id}`, { scroll: false });
    }
  }

  return (
    <div>
      <label
        htmlFor="subject-filter"
        className="block text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>
      <div className="relative mt-1">
        <input type="text" id="subject-filter" className="input pr-9" list="subject-filter-datalist" value={term} onChange={(e) => handleChange(e.target.value)} placeholder="Search subjects..." autoComplete="off" />
        {term ? <button type="button" className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-lg leading-none text-slate-400 hover:text-slate-700" onClick={() => handleChange("")} aria-label="Clear subject filter">×</button> : null}
      </div>
      <datalist id="subject-filter-datalist">
        {subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
    </div>
  );
}
