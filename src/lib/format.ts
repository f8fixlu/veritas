export function nowMs(): number {
  return Date.now();
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function percent(score: number | null, total: number | null): number {
  if (!score || !total) return 0;
  return Math.round((score / total) * 100);
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Joins the name parts into a single display name, skipping any that are blank. */
export function composeName(
  firstName: string | null | undefined,
  middleName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return [firstName, middleName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Current whole-year age from a birth date, or null when unknown. */
export function ageFromDateOfBirth(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}
