import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from "react";

type CardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

function classNames(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component className={classNames("card", className)} {...rest}>
      {children}
    </Component>
  );
}

export function CardSoft<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component className={classNames("card card-soft", className)} {...rest}>
      {children}
    </Component>
  );
}

export function CardHover<T extends ElementType = "div">({
  as,
  children,
  className,
  ...rest
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component className={classNames("card card-hover", className)} {...rest}>
      {children}
    </Component>
  );
}

export default Card;
