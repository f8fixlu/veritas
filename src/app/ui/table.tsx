import { type ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  footer?: ReactNode;
}

export function Table({
  children,
  className = "",
  wrapperClassName = "",
  footer,
}: TableProps) {
  const wrapperClasses = ["card overflow-hidden", wrapperClassName]
    .filter(Boolean)
    .join(" ");
  const tableClasses = ["w-full text-sm", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      <table className={tableClasses}>{children}</table>
      {footer}
    </div>
  );
}

export function TableHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const classes = [
    "border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <thead className={classes}>{children}</thead>;
}

export function TableBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const classes = ["divide-y divide-slate-100", className]
    .filter(Boolean)
    .join(" ");
  return <tbody className={classes}>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  const classes = [hover ? "hover:bg-slate-50/60" : "", className]
    .filter(Boolean)
    .join(" ");
  return <tr className={classes}>{children}</tr>;
}

export function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={className}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={className} colSpan={colSpan}>
      {children}
    </td>
  );
}

export default Table;
