import AssignInstructorSelect from "@/components/admin/student-instructor-assign";
import DeleteButton from "@/components/admin/delete-button";
import StudentsTable, {
  type StudentSubGroup,
  type StudentTableRow,
  type SubjectGroup,
} from "@/components/admin/students-table";
import { requireStaff } from "@/lib/auth";
import { finalizeManyIfExpired, type AttemptLike } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";
import { getDb } from "@/lib/db";
import {
  isAdmin,
  ownedAttemptWhere,
  ownedEnrollmentWhere,
  ownedStudentWhere,
  ownedSubjectWhere,
  unEnrolledStudentWhere,
} from "@/lib/scope";

export const metadata = { title: "Students — Veritas Admin" };

export default async function AdminStudentsPage() {
  const user = await requireStaff();
  const db = getDb();
  const admin = isAdmin(user);

  // Instructors only see the students linked to them (User.instructorId), and
  // only the attempts from their own exams. Admins keep the global view.
  const [subjects, students, newlyRegistered, instructors] = await Promise.all([
    db.subject.findMany({
      where: admin ? {} : ownedSubjectWhere(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        role: "STUDENT",
        ...(admin ? {} : ownedStudentWhere(user)),
      },
      orderBy: { name: "asc" },
      include: {
        enrollments: {
          where: admin ? {} : ownedEnrollmentWhere(user),
          include: { subject: true },
        },
        attempts: {
          where: admin ? {} : ownedAttemptWhere(user),
          orderBy: { startedAt: "desc" },
          include: { exam: { include: { subject: true } } },
        },
      },
    }),
    admin
      ? Promise.resolve([])
      : db.user.findMany({
          where: unEnrolledStudentWhere(user),
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true, createdAt: true },
        }),
    admin
      ? db.user.findMany({
          where: { role: "INSTRUCTOR" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  // Finalize any expired attempts once, in a few batched queries, so each
  // attempt is graded a single time no matter how many subject groups it
  // appears in.
  const allAttempts = students.flatMap((s) => s.attempts);
  const resolvedAttempts = await finalizeManyIfExpired(
    allAttempts.map((attempt) => ({
      attempt,
      durationMinutes: attempt.exam.durationMinutes,
    }))
  );
  const resolvedById = new Map<number, AttemptLike>(
    resolvedAttempts.map((a) => [a.id, a])
  );

  function buildRow(
    student: (typeof students)[number],
    subjectId: number | null
  ): StudentTableRow {
    const scoped = student.attempts.filter(
      (a) => subjectId === null || a.exam.subjectId === subjectId
    );
    const attempts = scoped.map((attempt) => {
      const resolved = resolvedById.get(attempt.id) ?? attempt;
      return {
        id: attempt.id,
        title: attempt.exam.title,
        subjectName: attempt.exam.subject.name,
        dateISO: (resolved.submittedAt ?? attempt.startedAt).toISOString(),
        submitted: Boolean(resolved.submittedAt),
        score: resolved.score,
        total: resolved.total,
      };
    });

    const graded = attempts.filter((a) => a.submitted && a.total);
    const avg = graded.length
      ? Math.round(
          graded.reduce((sum, a) => sum + percent(a.score, a.total), 0) /
            graded.length
        )
      : null;

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      gender: student.gender,
      avg,
      attempts,
    };
  }

  function genderSubgroups(
    prefix: string,
    rows: { row: StudentTableRow; gender: string | null }[]
  ): StudentSubGroup[] {
    const subgroups: StudentSubGroup[] = [
      { key: `${prefix}-male`, title: "Male", students: [] },
      { key: `${prefix}-female`, title: "Female", students: [] },
      {
        key: `${prefix}-unspecified`,
        title: "Unspecified",
        note: "Created before gender was recorded.",
        students: [],
      },
    ];
    for (const { row, gender } of rows) {
      if (gender === "MALE") subgroups[0].students.push(row);
      else if (gender === "FEMALE") subgroups[1].students.push(row);
      else subgroups[2].students.push(row);
    }
    return subgroups.filter((sg) => sg.students.length > 0);
  }

  const groups: SubjectGroup[] = [];

  for (const subject of subjects) {
    const members = students.filter((s) =>
      s.enrollments.some((e) => e.subject.id === subject.id)
    );
    const rows: { row: StudentTableRow; gender: string | null }[] = [];
    for (const member of members) {
      rows.push({ row: buildRow(member, subject.id), gender: member.gender });
    }
    groups.push({
      key: `subject-${subject.id}`,
      title: subject.name,
      students: [],
      subgroups: genderSubgroups(`subject-${subject.id}`, rows),
    });
  }

  const notEnrolled = students.filter(
    (s) => !s.enrollments.some((e) => subjects.some((sub) => sub.id === e.subject.id))
  );
  if (notEnrolled.length > 0) {
    const rows: { row: StudentTableRow; gender: string | null }[] = [];
    for (const student of notEnrolled) {
      rows.push({ row: buildRow(student, null), gender: student.gender });
    }
    groups.push({
      key: "unassigned",
      title: admin ? "No subject" : "Newly registered, not enrolled",
      note: admin
        ? "These students are not enrolled in any subject yet."
        : "Students linked to you who are not enrolled in any of your subjects yet.",
      students: [],
      subgroups: genderSubgroups("unassigned", rows),
    });
  }

  const unassigned = admin ? students.filter((s) => !s.instructorId) : [];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {admin
            ? "Students are linked to the instructor their registration code picked, or to you if you assign them below."
            : "The students linked to you, grouped by subject, then by gender. Click a row to see exam results."}
        </p>
      </div>

      {!admin ? (
        <div className="card mb-6 space-y-4 p-6">
          <div>
            <h2 className="font-medium text-slate-900">
              Newly registered
            </h2>
            <p className="text-sm text-slate-500">
              Students who registered with your code but are not enrolled in
              any of your subjects yet.
            </p>
          </div>
          {newlyRegistered.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Nothing waiting — every linked student is already enrolled.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {newlyRegistered.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {s.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.email} · registered {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <DeleteButton
                    endpoint={`/api/admin/students/${s.id}`}
                    label="Delete"
                    confirmText={`Permanently delete ${s.name} (${s.email})? All of their exam attempts, answers and enrollments will be removed. This cannot be undone.`}
                    requirePassword
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-400">
            Enroll them from a subject&apos;s page — the Add box only searches
            your own students.
          </p>
        </div>
      ) : null}

      {unassigned.length > 0 ? (
        <div className="card mb-6 space-y-3 p-6">
          <div>
            <h2 className="font-medium text-slate-900">
              Unassigned students
            </h2>
            <p className="text-sm text-slate-500">
              No instructor yet (registered before codes, or with a manual
              account). Link each one so they can be enrolled and seen only by
              their instructor.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {unassigned.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {s.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{s.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AssignInstructorSelect
                    studentId={s.id}
                    instructors={instructors}
                  />
                  <DeleteButton
                    endpoint={`/api/admin/students/${s.id}`}
                    label="Delete"
                    confirmText={`Permanently delete ${s.name} (${s.email})? All of their exam attempts, answers and enrollments will be removed. This cannot be undone.`}
                    requirePassword
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No students yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {admin
              ? "Students appear here after they register an account."
              : "Students appear here after they register using your code."}
          </p>
        </div>
      ) : (
        <StudentsTable groups={groups} canDeleteStudents={true} />
      )}
    </>
  );
}