import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

type MenuButtonProps = {
  children: ReactNode;
  className?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "type">;

export function MenuItem({ children, className = "", type = "button", ...rest }: MenuButtonProps) {
  const classes = ["menu-item", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

export function MenuItemLink({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  const classes = ["menu-item", className].filter(Boolean).join(" ");
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function MenuItemDanger({ children, className = "", type = "button", ...rest }: MenuButtonProps) {
  const classes = ["menu-item menu-item-danger", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
