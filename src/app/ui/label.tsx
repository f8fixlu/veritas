import { type ReactNode } from "react";

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Label({ htmlFor, children, className = "" }: LabelProps) {
  const classes = [
    "block text-xs font-medium uppercase tracking-wide text-slate-500",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <label htmlFor={htmlFor} className={classes}>
      {children}
    </label>
  );
}

export default Label;
