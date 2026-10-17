import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "slate";
  className?: string;
  title?: string;
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "badge",
  success: "badge bg-emerald-50 text-emerald-700",
  warning: "badge bg-amber-50 text-amber-700",
  danger: "badge bg-red-50 text-red-700",
  info: "badge bg-indigo-50 text-indigo-700",
  slate: "badge bg-slate-100 text-slate-600",
};

export function Badge({
  children,
  variant = "default",
  className = "",
  title,
}: BadgeProps) {
  const classes = [variants[variant], className].filter(Boolean).join(" ");
  return (
    <span className={classes} title={title}>
      {children}
    </span>
  );
}

export default Badge;
