// Pure assessment-kind helpers. Kept separate from `lib/exam.ts` because that
// module opens the database (better-sqlite3) and must never be imported by a
// client component.
export const ASSESSMENT_KINDS = ["EXAM", "QUIZ"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export function isAssessmentKind(value: unknown): value is AssessmentKind {
  return value === "EXAM" || value === "QUIZ";
}

/** Path segment and display noun for an assessment kind. */
export function assessmentMeta(kind: AssessmentKind) {
  return kind === "QUIZ"
    ? {
        noun: "quiz",
        plural: "quizzes",
        title: "Quiz",
        basePath: "/admin/quiz",
      } as const
    : {
        noun: "exam",
        plural: "exams",
        title: "Exam",
        basePath: "/admin/exams",
      } as const;
}

export function normalizeAssessmentKind(value: unknown): AssessmentKind {
  return isAssessmentKind(value) ? value : "EXAM";
}
