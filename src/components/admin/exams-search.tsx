"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExamsSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [term, setTerm] = useState(initial);

  useEffect(() => {
    setTerm(initial);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [initial]);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set("q", term);
      else params.delete("q");
      params.delete("page");
      router.push(`?${params.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Search exams
      </label>
      <input
        type="text"
        className="input mt-1"
        placeholder="Type to filter exams..."
        autoComplete="off"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
    </div>
  );
}
