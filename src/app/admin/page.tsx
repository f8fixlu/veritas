import Link from "next/link";
import {
  IconBookOpen,
  IconClipboardList,
  IconCirclePlay,
  IconGraduationCap,
  IconPencil,
  IconUserX,
  IconUsers,
} from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  isAdmin,
  ownedAttemptWhere,
  ownedExamWhere,
  ownedSubjectWhere,
  unEnrolledStudentWhere,
} from "@/lib/scope";
import FilterSelect, {
  type FilterOption,
} from "@/components/admin/filter-select";
import InstructorCodeCard from "@/components/admin/instructor-code-card";
import Pager from "@/components/admin/pager";


const PAGE_SIZE = 10;

const STATUS_FILTERS: FilterOption[] = [
  { value: "inprogress", label: "In progress" },
  { value: "notstarted", label: "Not started" },
];

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card card-hover px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className="text-indigo-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

export const metadata = { title: "Admin — Veritas" };

function AdminHub() {
  const links = [
    {
      href: "/admin/instructors",
      icon: <IconGraduationCap size={18} />,
      title: "Instructors",
      body: "Create and remove instructor accounts. Each instructor manages their own subjects and exams.",
    },
    {
      href: "/admin/students",
      icon: <IconUsers size={18} />,
      title: "Students",
      body: "Every registered student, their enrollments and their results across all subjects.",
    },
    {
      href: "/admin/subjects",
      icon: <IconBookOpen size={18} />,
      title: "Subjects",
      body: "Delete-only list of every subject and who owns it.",
    },
    {
      href: "/admin/exams",
      icon: <IconClipboardList size={18} />,
      title: "Exams",
      body: "Delete-only list of every exam and who owns it.",
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Administration
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage instructor accounts and students. Subjects and exams belong to
        their instructor — an admin can review what exists and delete it, but
        cannot open or change it.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="card card-hover flex items-start gap-3 p-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {link.icon}
            </span>
            <span className="min-w-0">
              <h2 className="font-medium text-slate-900">{link.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{link.body}</p>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    exam?: string;
    status?: string;
    pendingPage?: string;
  }>;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) return <AdminHub />;

  const {
    subject: subjectParam,
    exam: examParam,
    status: statusParam,
    pendingPage: pageParam,
  } = await searchParams;

  const db = getDb();
  const [students, subjects, exams, attempts, myself, newStudents] =
    await Promise.all([
      db.user.count({
        where: { role: "STUDENT", enrollments: { some: { subject: ownedSubjectWhere(user) } } },
      }),
      db.subject.count({ where: ownedSubjectWhere(user) }),
      db.exam.count({ where: ownedExamWhere(user) }),
      db.attempt.count({ where: ownedAttemptWhere(user) }),
      db.user.findUnique({
        where: { id: user.id },
        select: { studentCode: true },
      }),
      db.user.count({ where: unEnrolledStudentWhere(user) }),
    ]);

  const draftCount = await db.exam.count({
    where: { published: false, ...ownedExamWhere(user) },
  });

  const publishedExams = await db.exam.findMany({
    where: { published: true, ...ownedExamWhere(user) },
    orderBy: { createdAt: "desc" },
    include: {
      subject: true,
      attempts: { select: { userId: true, startedAt: true, submittedAt: true } },
    },
  });

  const draftExams = await db.exam.findMany({
    where: { published: false, ...ownedExamWhere(user) },
    orderBy: { createdAt: "desc" },
    include: {
      subject: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });

  const subjectIds = [...new Set(publishedExams.map((e) => e.subjectId))];
  const enrollments =
    subjectIds.length > 0
      ? await db.enrollment.findMany({
          where: { subjectId: { in: subjectIds } },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : [];

  const enrollmentsBySubject = new Map<number, typeof enrollments>();
  for (const enrollment of enrollments) {
    const list = enrollmentsBySubject.get(enrollment.subjectId) ?? [];
    list.push(enrollment);
    enrollmentsBySubject.set(enrollment.subjectId, list);
  }

  // Flatten every (exam, enrolled student) pair that has no submitted attempt
  // into one paginated list. A student who started but has not submitted counts
  // as "in progress"; the rest have not started.
  type PendingRow = {
    examId: number;
    examTitle: string;
    subjectId: number;
    subjectName: string;
    studentId: number;
    studentName: string;
    studentEmail: string;
    started: boolean;
    startedAt: Date | null;
  };

  const pendingRows: PendingRow[] = [];
  for (const exam of publishedExams) {
    const enrolled = [...(enrollmentsBySubject.get(exam.subjectId) ?? [])].sort(
      (a, b) => a.user.name.localeCompare(b.user.name)
    );
    const submittedIds = new Set(
      exam.attempts.filter((a) => a.submittedAt).map((a) => a.userId)
    );
    const latestAttemptByUser = new Map<
      number,
      (typeof exam.attempts)[number]
    >();
    for (const attempt of exam.attempts) {
      const previous = latestAttemptByUser.get(attempt.userId);
      if (!previous || attempt.startedAt > previous.startedAt) {
        latestAttemptByUser.set(attempt.userId, attempt);
      }
    }
    for (const enrollment of enrolled) {
      if (submittedIds.has(enrollment.user.id)) continue;
      const attempt = latestAttemptByUser.get(enrollment.user.id);
      pendingRows.push({
        examId: exam.id,
        examTitle: exam.title,
        subjectId: exam.subjectId,
        subjectName: exam.subject.name,
        studentId: enrollment.user.id,
        studentName: enrollment.user.name,
        studentEmail: enrollment.user.email,
        started: Boolean(attempt),
        startedAt: attempt?.startedAt ?? null,
      });
    }
  }

  // Filter options come from the rows themselves so a dropdown never offers a
  // subject or exam with no pending students.
  const subjectMap = new Map<number, string>();
  for (const row of pendingRows) subjectMap.set(row.subjectId, row.subjectName);
  const subjectOptions = [...subjectMap]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const examMap = new Map<number, string>();
  for (const row of pendingRows) examMap.set(row.examId, row.examTitle);
  const examOptions = [...examMap]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const subjectFilter = subjectOptions.some((s) => s.id === Number(subjectParam))
    ? Number(subjectParam)
    : null;
  const examFilter = examOptions.some((e) => e.id === Number(examParam))
    ? Number(examParam)
    : null;
  const statusFilter = STATUS_FILTERS.some((s) => s.value === statusParam)
    ? (statusParam as string)
    : "";

  const filteredPending = pendingRows.filter((row) => {
    if (subjectFilter !== null && row.subjectId !== subjectFilter) return false;
    if (examFilter !== null && row.examId !== examFilter) return false;
    if (statusFilter === "inprogress" && !row.started) return false;
    if (statusFilter === "notstarted" && row.started) return false;
    return true;
  });

  const pendingTotal = filteredPending.length;
  const pendingTotalPages = Math.max(
    1,
    Math.ceil(pendingTotal / PAGE_SIZE)
  );
  const pendingPage = Math.min(
    Math.max(1, Number(pageParam) || 1),
    pendingTotalPages
  );
  const pendingPageRows = filteredPending.slice(
    (pendingPage - 1) * PAGE_SIZE,
    pendingPage * PAGE_SIZE
  );

  const pendingHref = (target: number) => {
    const params = new URLSearchParams();
    if (subjectFilter) params.set("subject", String(subjectFilter));
    if (examFilter) params.set("exam", String(examFilter));
    if (statusFilter) params.set("status", statusFilter);
    if (target > 1) params.set("pendingPage", String(target));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  const filterValues = {
    subject: subjectFilter ? String(subjectFilter) : "",
    exam: examFilter ? String(examFilter) : "",
    status: statusFilter,
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Overview
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage subjects, exams and monitor activity
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Students" value={students} icon={<IconUsers size={14} />} />
        <StatCard label="New" value={newStudents} icon={<IconUserX size={14} />} />
        <StatCard label="Subjects" value={subjects} icon={<IconBookOpen size={14} />} />
        <StatCard label="Exams" value={exams} icon={<IconClipboardList size={14} />} />
        <StatCard label="Draft exams" value={draftCount} icon={<IconPencil size={14} />} />
        <StatCard label="Attempts" value={attempts} icon={<IconCirclePlay size={14} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/subjects"
            className="card card-hover flex items-start gap-3 p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconBookOpen size={18} />
            </span>
            <span className="min-w-0">
              <h2 className="font-medium text-slate-900">Manage subjects</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create subjects and enroll students into them.
              </p>
            </span>
          </Link>
          <Link
            href="/admin/exams"
            className="card card-hover flex items-start gap-3 p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconClipboardList size={18} />
            </span>
            <span className="min-w-0">
              <h2 className="font-medium text-slate-900">Manage exams</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create timed exams and import question lists.
              </p>
            </span>
          </Link>
        </div>
        {myself?.studentCode ? (
          <InstructorCodeCard code={myself.studentCode} />
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Draft exams
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Not yet visible to students — add questions, then publish when ready
        </p>

        {draftExams.length === 0 ? (
          <p className="mt-4 inline-block rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            No drafts — every exam is published.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {draftExams.map((exam) => (
              <li key={exam.id} className="card card-soft px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">
                      {exam.title}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {exam.subject.name} · {exam._count.questions} question
                      {exam._count.questions === 1 ? "" : "s"} ·{" "}
                      {exam.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        exam._count.questions === 0
                          ? "badge bg-red-50 text-red-700"
                          : "badge bg-emerald-50 text-emerald-700"
                      }
                    >
                      {exam._count.questions === 0
                        ? "Needs questions"
                        : "Ready to publish"}
                    </span>
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingRows.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Haven&apos;t taken the exam yet
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enrolled students without a submitted attempt for each published
                exam
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <FilterSelect
                param="subject"
                label="Subject"
                value={filterValues.subject}
                options={subjectOptions.map((s) => ({
                  value: String(s.id),
                  label: s.name,
                }))}
                basePath="/admin"
                filters={filterValues}
                className="w-full sm:w-44"
              />
              <FilterSelect
                param="exam"
                label="Exam"
                value={filterValues.exam}
                options={examOptions.map((e) => ({
                  value: String(e.id),
                  label: e.title,
                }))}
                basePath="/admin"
                filters={filterValues}
                className="w-full sm:w-44"
              />
              <FilterSelect
                param="status"
                label="Status"
                value={filterValues.status}
                options={STATUS_FILTERS}
                basePath="/admin"
                filters={filterValues}
                className="w-full sm:w-40"
              />
            </div>
          </div>

          {pendingTotal === 0 ? (
            <div className="card px-5 py-4 text-sm text-slate-500">
              No students match these filters.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-3">
                      Student
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Exam
                    </th>
                    <th scope="col" className="hidden px-5 py-3 sm:table-cell">
                      Subject
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Status
                    </th>
                    <th scope="col" className="hidden px-5 py-3 md:table-cell">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPageRows.map((row) => (
                    <tr
                      key={`${row.examId}:${row.studentId}`}
                      className="hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <span className="block truncate font-medium text-slate-800">
                          {row.studentName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {row.studentEmail}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/exams/${row.examId}/report`}
                          className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          {row.examTitle}
                        </Link>
                      </td>
                      <td className="hidden px-5 py-3 text-slate-500 sm:table-cell">
                        {row.subjectName}
                      </td>
                      <td className="px-5 py-3">
                        {row.started ? (
                          <span className="badge bg-amber-50 text-amber-700">
                            In progress
                          </span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-600">
                            Not started
                          </span>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                        {row.startedAt ? formatDateTime(row.startedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pendingTotal > 0 ? (
            <div className="mt-3">
              <Pager
                page={pendingPage}
                totalPages={pendingTotalPages}
                total={pendingTotal}
                pageSize={PAGE_SIZE}
                hrefFor={pendingHref}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
