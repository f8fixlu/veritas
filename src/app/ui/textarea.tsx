"use client";

import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  helperText?: ReactNode;
  textareaClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      className = "",
      textareaClassName = "",
      id,
      children,
      ...rest
    },
    ref,
  ) => {
    const containerClasses = ["w-full", className].filter(Boolean).join(" ");
    const textareaClasses = ["input", textareaClassName]
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
        <textarea
          id={id}
          ref={ref}
          className={textareaClasses}
          {...rest}
        >
          {children}
        </textarea>
        {helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
