import NewlyRegisteredTable, {
  type NewlyRegisteredRow,
} from "@/components/admin/newly-registered-table";
import Pager from "@/components/admin/pager";
import StudentsSearch from "@/components/admin/students-search";
import StudentsTable, {
  type StudentTableRow,
} from "@/components/admin/students-table";
import SubjectFilter from "@/components/admin/subject-filter";
import { requireStaff } from "@/lib/auth";
import { finalizeManyIfExpired, type AttemptLike } from "@/lib/exam";
import { percent } from "@/lib/format";
import { getDb } from "@/lib/db";
import {
  enrolledStudentWhere,
  isAdmin,
  ownedAttemptWhere,
  ownedSubjectWhere,
  unEnrolledStudentWhere,
} from "@/lib/scope";

export const metadata = { title: "Students — Veritas Admin" };

const PAGE_SIZE = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; page?: string; newPage?: string; q?: string }>;
}) {
  const user = await requireStaff();
  const db = getDb();
  const admin = isAdmin(user);
  const { subject: subjectParam, page: pageParam, newPage: newPageParam, q: qParam } =
    await searchParams;
  const q = qParam?.trim();
  const subjectId = subjectParam ? Number(subjectParam) : null;

  // Enrolled students: one flat list, scoped to the caller and optionally to a
  // single subject. Instructors only ever count/see their own linked students
  // enrolled in their own subjects; admins keep the global view.
  let mainWhere: any = enrolledStudentWhere(user, subjectId);
  if (q) {
    mainWhere = {
      ...mainWhere,
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
      ],
    };
  }
  const mainTotal = await db.user.count({ where: mainWhere });
  const mainTotalPages = Math.max(1, Math.ceil(mainTotal / PAGE_SIZE));
  const mainPage = clamp(Number(pageParam) || 1, 1, mainTotalPages);

  const enrollmentInclude = admin
    ? {}
    : { subject: { ownerId: user.id } };
  const attemptsWhere = subjectId
    ? { exam: { subjectId, ...(admin ? {} : { subject: { ownerId: user.id } }) } }
    : admin
      ? {}
      : ownedAttemptWhere(user);

  const pageStudents = await db.user.findMany({
    where: mainWhere,
    orderBy: { name: "asc" },
    skip: (mainPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      enrollments: {
        where: enrollmentInclude,
        include: { subject: { select: { name: true } } },
      },
      attempts: {
        where: attemptsWhere,
        orderBy: { startedAt: "desc" },
        include: { exam: { include: { subject: true } } },
      },
    },
  });

  // Finalize any expired attempts once, in a few batched queries, so each
  // attempt is graded a single time before it is scored below.
  const resolvedAttempts = await finalizeManyIfExpired(
    pageStudents.flatMap((student) => student.attempts).map((attempt) => ({
      attempt,
      durationMinutes: attempt.exam.durationMinutes,
    }))
  );
  const resolvedById = new Map<number, AttemptLike>(
    resolvedAttempts.map((a) => [a.id, a])
  );

  const rows: StudentTableRow[] = pageStudents.map((student) => {
    const attempts = student.attempts.map((attempt) => {
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
      subjects: student.enrollments.map((e) => e.subject.name),
      avg,
      attempts,
    };
  });

  // Second table: students with no enrollment. For an instructor this is the
  // "newly registered" list (linked, not yet enrolled); for an admin it is the
  // legacy "unassigned" list (no instructor), which keeps the assign control.
  const newWhere = admin
    ? { role: "STUDENT" as const, instructorId: null }
    : unEnrolledStudentWhere(user);
  const newTotal = await db.user.count({ where: newWhere });
  const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
  const newPage = clamp(Number(newPageParam) || 1, 1, newTotalPages);

  const newStudents = await db.user.findMany({
    where: newWhere,
    orderBy: { createdAt: "desc" },
    skip: (newPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, name: true, email: true, createdAt: true },
  });
  const newRows: NewlyRegisteredRow[] = newStudents.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email,
    registeredISO: student.createdAt.toISOString(),
  }));

  const [subjects, instructors] = await Promise.all([
    db.subject.findMany({
      where: admin ? {} : ownedSubjectWhere(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    admin
      ? db.user.findMany({
          where: { role: "INSTRUCTOR" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const showNewSection = !admin || newTotal > 0;

  const mainHref = (target: number) => {
    const params = new URLSearchParams();
    if (subjectId) params.set("subject", String(subjectId));
    if (q) params.set("q", q);
    if (target > 1) params.set("page", String(target));
    if (showNewSection && newPage > 1) params.set("newPage", String(newPage));
    const qs = params.toString();
    return qs ? `/admin/students?${qs}` : "/admin/students";
  };

  const newHref = (target: number) => {
    const params = new URLSearchParams();
    if (subjectId) params.set("subject", String(subjectId));
    if (q) params.set("q", q);
    if (mainPage > 1) params.set("page", String(mainPage));
    if (target > 1) params.set("newPage", String(target));
    const qs = params.toString();
    return qs ? `/admin/students?${qs}` : "/admin/students";
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {admin
            ? "Every enrolled student in one list. Filter by subject, or link unassigned students to an instructor below."
            : "Your enrolled students in one list. Filter by subject, or enrol the newly registered below."}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        {subjects.length > 0 ? (
          <SubjectFilter
            subjects={subjects}
            selectedId={subjectId}
            basePath="/admin/students"
          />
        ) : null}
        <div className="w-full sm:w-56">
          <StudentsSearch />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {subjectId ? "Students in subject" : "Enrolled students"}
          </h2>
          <span className="text-sm text-slate-500">
            {`${mainTotal} ${mainTotal === 1 ? "student" : "students"}`}
          </span>
        </div>
        <StudentsTable
          students={rows}
          canDeleteStudents={true}
          emptyLabel={
            subjectId
              ? "No students are enrolled in this subject yet."
              : "No students have enrolled in your subjects yet."
          }
        />
        <div className="mt-3">
          <Pager
            page={mainPage}
            totalPages={mainTotalPages}
            total={mainTotal}
            pageSize={PAGE_SIZE}
            hrefFor={mainHref}
          />
        </div>
      </section>

      {showNewSection ? (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {admin ? "Unassigned students" : "Newly registered"}
            </h2>
            <span className="text-sm text-slate-500">
              {`${newTotal} ${newTotal === 1 ? "student" : "students"}`}
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            {admin
              ? "No instructor yet (registered before codes, or a manual account). Link each one so they can be enrolled and seen only by their instructor."
              : "Students who registered with your code but are not enrolled in any of your subjects yet."}
          </p>
          <NewlyRegisteredTable
            students={newRows}
            instructors={admin ? instructors : undefined}
            emptyLabel={
              admin
                ? "Every student has an instructor."
                : "Nothing waiting — every linked student is already enrolled."
            }
          />
          <div className="mt-3">
            <Pager
              page={newPage}
              totalPages={newTotalPages}
              total={newTotal}
              pageSize={PAGE_SIZE}
              hrefFor={newHref}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
