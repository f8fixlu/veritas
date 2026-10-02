import { ROLES, type SessionUser } from "./auth";
import { getDb } from "./db";

/**
 * Ownership scoping.
 *
 * A subject is the tenancy boundary: it belongs to the instructor who created
 * it, and every exam below it inherits that owner. Students enroll per subject,
 * so "this instructor's students" means "students enrolled in this
 * instructor's subjects".
 *
 * Rules enforced here:
 *  - INSTRUCTOR: full read/write on their own subjects, exams, questions,
 *    attempts and snapshots. Nothing from another instructor is reachable, and
 *    every scoped lookup returns 404 (not 403) so ids don't leak existence.
 *  - ADMIN: no read/create/update access to subjects or exams. Admins manage
 *    instructors and students, and may only *delete* any subject or exam.
 */

export function isAdmin(user: SessionUser): boolean {
  return user.role === ROLES.ADMIN;
}

/** Creating and editing subjects, exams, questions and enrollments. */
export function canManageContent(user: SessionUser): boolean {
  return user.role === ROLES.INSTRUCTOR;
}

/** Deleting a subject or exam: the owner, or an admin (delete-only). */
export function canDeleteContent(user: SessionUser): boolean {
  return user.role === ROLES.INSTRUCTOR || user.role === ROLES.ADMIN;
}

export function ownedSubjectWhere(user: SessionUser) {
  return { ownerId: user.id };
}

export function ownedEnrollmentWhere(user: SessionUser) {
  return { subject: { ownerId: user.id } };
}

export function ownedExamWhere(user: SessionUser) {
  return { subject: { ownerId: user.id } };
}

export function ownedAttemptWhere(user: SessionUser) {
  return { exam: { subject: { ownerId: user.id } } };
}

export function ownedQuestionWhere(user: SessionUser) {
  return { exam: { subject: { ownerId: user.id } } };
}

export function ownedSnapshotWhere(user: SessionUser) {
  return { attempt: { exam: { subject: { ownerId: user.id } } } };
}

/**
 * A student is linked to exactly one instructor (`User.instructorId`, set from
 * the code they enter at registration). Instructors only ever see the students
 * linked to them, never another instructor's.
 */
export function ownedStudentWhere(user: SessionUser) {
  return { role: ROLES.STUDENT, instructorId: user.id };
}

/**
 * Newly registered students of this instructor: linked to them but not yet
 * enrolled in any of their subjects. Used by the "Newly registered" list on
 * the instructor's students page and the overview stat.
 */
export function unEnrolledStudentWhere(user: SessionUser) {
  return {
    ...ownedStudentWhere(user),
    enrollments: { none: { subject: { ownerId: user.id } } },
  };
}

/**
 * Distinct students enrolled in any of the instructor's subjects. Used by the
 * students page and by the enrollment panel, so a subject page never lists the
 * global student roster.
 */
export async function ownedStudentIds(user: SessionUser): Promise<number[]> {
  const db = getDb();
  const rows = await db.enrollment.findMany({
    where: { subject: { ownerId: user.id } },
    distinct: ["userId"],
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

const STUDENT_SEARCH_LIMIT = 10;

/**
 * Finds students by name or email for the enroll-to-add box. A subject page
 * only ever renders the students already in the instructor's subjects, so this
 * is the single place a name or email outside that set can be looked up.
 *
 * Instructors are restricted to the students linked to them
 * (`User.instructorId`), so a subject page can never find, let alone enroll,
 * another instructor's student.
 *
 * `contains` compiles to `LIKE '%q%'` on SQLite, which is case-insensitive for
 * ASCII — `mode: "insensitive"` is not supported on this provider.
 */
export async function searchStudents(
  user: SessionUser,
  query: string,
  excludeIds: number[] = []
) {
  const q = query.trim();
  if (q.length < 2) return [];
  return getDb().user.findMany({
    where: {
      role: ROLES.STUDENT,
      instructorId: user.id,
      id: { notIn: excludeIds },
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: STUDENT_SEARCH_LIMIT,
  });
}
