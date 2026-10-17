"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  helperText?: ReactNode;
  rightAdornment?: ReactNode;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      rightAdornment,
      className = "",
      inputClassName = "",
      id,
      ...rest
    },
    ref,
  ) => {
    const containerClasses = ["w-full", className].filter(Boolean).join(" ");
    const inputClasses = ["input", inputClassName].filter(Boolean).join(" ");

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
        <div className={label ? "relative mt-1" : "relative"}>
          <input id={id} ref={ref} className={inputClasses} {...rest} />
          {rightAdornment ? (
            <div className="absolute inset-y-0 right-0 flex items-center">
              {rightAdornment}
            </div>
          ) : null}
        </div>
        {helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
