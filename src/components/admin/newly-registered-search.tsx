"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewlyRegisteredSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("nq") ?? "";
  const [term, setTerm] = useState(initial);

  useEffect(() => {
    setTerm((prev) => (prev === initial ? prev : initial));
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set("nq", term);
      else params.delete("nq");
      params.delete("newPage");
      router.push(`?${params.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Search newly registered
      </label>
      <input
        type="text"
        className="input mt-1"
        placeholder="Type to filter..."
        autoComplete="off"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
    </div>
  );
}
