export const STUDENT_EDUCATION_LEVELS = [
  { value: "UNDERGRADUATE", label: "Undergraduate" },
  { value: "MASTERAL", label: "Masteral" },
  { value: "DOCTORATE", label: "Doctorate" },
] as const;

export function isGraduateLevel(value: string) {
  return value === "MASTERAL" || value === "DOCTORATE";
}
