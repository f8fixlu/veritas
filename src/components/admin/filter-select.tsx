"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent } from "react";

export type FilterOption = { value: string; label: string };

/**
 * A labelled dropdown that writes a single query parameter and re-navigates.
 * Choosing the empty value ("All") removes the parameter. `filters` carries the
 * other active values so switching one dropdown preserves the rest; the
 * dropdown's own parameter is always dropped from the preserved set and
 * replaced with the new choice. `resetParams` lists dependent parameters
 * (e.g. an "exam" dropdown that is scoped by this "subject" one) that are
 * always dropped when this dropdown changes, so a stale child filter cannot
 * silently survive its parent.
 */
export default function FilterSelect({
  param,
  label,
  value,
  options,
  allLabel = "All",
  basePath,
  filters = {},
  resetParams = [],
  className,
  selectClassName = "input mt-1",
  disabled = false,
}: {
  param: string;
  label: string;
  value: string;
  options: FilterOption[];
  allLabel?: string;
  basePath: string;
  filters?: Record<string, string>;
  resetParams?: string[];
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const id = `filter-${param}`;

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams();
    for (const [key, val] of Object.entries(filters)) {
      if (key !== param && val && !resetParams.includes(key)) next.set(key, val);
    }
    if (e.target.value) next.set(param, e.target.value);
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>
      <select
        id={id}
        className={selectClassName}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
