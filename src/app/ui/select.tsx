"use client";

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  className?: string;
  selectClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, className = "", selectClassName = "", id, children, ...rest },
    ref,
  ) => {
    const containerClasses = [className].filter(Boolean).join(" ");
    const selectClasses = ["input", label ? "mt-1" : "", selectClassName]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={containerClasses}>
        {label ? (
          <label
            htmlFor={id}
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            {label}
          </label>
        ) : null}
        <select id={id} ref={ref} className={selectClasses} {...rest}>
          {children}
        </select>
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
