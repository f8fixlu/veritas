import StudentsTable, {
  type StudentSubGroup,
  type StudentTableRow,
  type SubjectGroup,
} from "@/components/admin/students-table";
import { finalizeIfExpired } from "@/lib/exam";
import { percent } from "@/lib/format";
import { getDb } from "@/lib/db";

export const metadata = { title: "Students — Veritas Admin" };

export default async function AdminStudentsPage() {
  const db = getDb();
  const [subjects, students] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { name: "asc" },
      include: {
        enrollments: { include: { subject: true } },
        attempts: {
          orderBy: { startedAt: "desc" },
          include: { exam: { include: { subject: true } } },
        },
      },
    }),
  ]);

  async function buildRow(
    student: (typeof students)[number],
    subjectId: number | null
  ): Promise<StudentTableRow> {
    const scoped = student.attempts.filter(
      (a) => subjectId === null || a.exam.subjectId === subjectId
    );
    const attempts = await Promise.all(
      scoped.map(async (attempt) => {
        const resolved = await finalizeIfExpired(
          attempt,
          attempt.exam.durationMinutes
        );
        return {
          id: attempt.id,
          title: attempt.exam.title,
          subjectName: attempt.exam.subject.name,
          dateISO: (resolved.submittedAt ?? attempt.startedAt).toISOString(),
          submitted: Boolean(resolved.submittedAt),
          score: resolved.score,
          total: resolved.total,
        };
      })
    );

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
      rows.push({ row: await buildRow(member, subject.id), gender: member.gender });
    }
    groups.push({
      key: `subject-${subject.id}`,
      title: subject.name,
      students: [],
      subgroups: genderSubgroups(`subject-${subject.id}`, rows),
    });
  }

  const unassigned = students.filter((s) => s.enrollments.length === 0);
  if (unassigned.length > 0) {
    const rows: { row: StudentTableRow; gender: string | null }[] = [];
    for (const student of unassigned) {
      rows.push({ row: await buildRow(student, null), gender: student.gender });
    }
    groups.push({
      key: "unassigned",
      title: "No subject",
      note: "These students are not enrolled in any subject yet.",
      students: [],
      subgroups: genderSubgroups("unassigned", rows),
    });
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Students grouped by subject, then by gender. Click a row to see exam
          results.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No students yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Students appear here after they register an account.
          </p>
        </div>
      ) : (
        <StudentsTable groups={groups} />
      )}
    </>
  );
}
