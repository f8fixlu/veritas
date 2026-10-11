"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function NewlyRegisteredStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "all";

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        Status
      </label>
      <select
        className="input mt-1"
        value={status}
        onChange={(e) => {
          const v = e.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (v !== "all") params.set("status", v);
          else params.delete("status");
          params.delete("newPage");
          router.push(`?${params.toString()}`, { scroll: false });
        }}
      >
        <option value="all">All</option>
        <option value="active">Activated</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}
