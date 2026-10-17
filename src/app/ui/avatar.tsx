const SIZES = {
  sm: "h-6 w-6",
  nav: "h-7 w-7 sm:h-6 sm:w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

export type AvatarSize = keyof typeof SIZES;

/** First letters of the first two words of a name, e.g. "Ada Lovelace" → "AL". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Compose initials from first and last name. Falls back to the composite name
 * when the parts are missing.
 */
export function nameInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackName?: string | null
): string {
  const parts = [firstName, lastName].filter(Boolean) as string[];
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  if (fallbackName) return initials(fallbackName);
  return "?";
}

/**
 * Circular avatar used in every list of students, instructors and users.
 * Renders the uploaded picture when `src` is provided, otherwise the initials.
 */
export function Avatar({
  name,
  firstName,
  lastName,
  src,
  size = "sm",
  className,
}: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const sizeClass = SIZES[size] ?? SIZES.sm;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${sizeClass}${className ? ` ${className}` : ""}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700 ${sizeClass}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      {nameInitials(firstName, lastName, name)}
    </span>
  );
}

export default Avatar;
