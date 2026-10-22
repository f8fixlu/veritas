import Link from "next/link";
import {
  IconBookOpen,
  IconClipboardList,
  IconCirclePlay,
  IconGraduationCap,
  IconHelpCircle,
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

import Pager from "@/components/admin/pager";
import AttemptLiveProgress from "@/components/admin/attempt-live-progress";
import AttemptStartWatcher from "@/components/admin/attempt-start-watcher";
import ProgressSearch from "@/components/admin/progress-search";
import { Suspense } from "react";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardHover,
  CardSoft,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/ui";
import { finalizeManyIfExpired } from "@/lib/exam";


const PAGE_SIZE = 10;

const STATUS_FILTERS: FilterOption[] = [
  { value: "submitted", label: "Submitted" },
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
    <CardHover className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className="text-indigo-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </CardHover>
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
          <CardHover
            as={Link}
            key={link.href}
            href={link.href}
            className="flex items-start gap-3 p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {link.icon}
            </span>
            <span className="min-w-0">
              <h2 className="font-medium text-slate-900">{link.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{link.body}</p>
            </span>
          </CardHover>
        ))}
      </div>
    </>
  );
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    student?: string;
    subject?: string;
    exam?: string;
    status?: string;
    pendingPage?: string;
  }>;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) return <AdminHub />;

  const {
    student: studentParam,
    subject: subjectParam,
    exam: examParam,
    status: statusParam,
    pendingPage: pageParam,
  } = await searchParams;

  const db = getDb();
  const [students, subjects, exams, attempts, newStudents] =
    await Promise.all([
      db.user.count({
        where: { role: "STUDENT", enrollments: { some: { subject: ownedSubjectWhere(user) } } },
      }),
      db.subject.count({ where: ownedSubjectWhere(user) }),
      db.exam.count({ where: ownedExamWhere(user) }),
      db.attempt.count({ where: ownedAttemptWhere(user) }),
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
      attempts: {
        select: {
          id: true,
          examId: true,
          userId: true,
          startedAt: true,
          submittedAt: true,
          score: true,
          total: true,
        },
      },
      _count: { select: { questions: true } },
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
            user: { select: { id: true, name: true, firstName: true, lastName: true, avatarData: true, email: true } },
          },
        })
      : [];

  const enrollmentsBySubject = new Map<number, typeof enrollments>();
  for (const enrollment of enrollments) {
    const list = enrollmentsBySubject.get(enrollment.subjectId) ?? [];
    list.push(enrollment);
    enrollmentsBySubject.set(enrollment.subjectId, list);
  }

  const resolvedAttempts = (
    await Promise.all(
      publishedExams.map((exam) =>
        finalizeManyIfExpired(
          exam.attempts.map((attempt) => ({
            attempt,
            durationMinutes: exam.durationMinutes,
          }))
        )
      )
    )
  ).flat();
  const inProgressAttemptIds = resolvedAttempts
    .filter((attempt) => !attempt.submittedAt)
    .map((attempt) => attempt.id);
  const answeredGroups = inProgressAttemptIds.length
    ? await db.answer.groupBy({
        by: ["attemptId"],
        where: {
          attemptId: { in: inProgressAttemptIds },
          selectedOption: { not: null },
        },
        _count: { _all: true },
      })
    : [];
  const answeredByAttempt = new Map(
    answeredGroups.map((group) => [group.attemptId, group._count._all])
  );

  // Flatten every (exam, enrolled student) pair into one paginated list. Live
  // components keep active and not-yet-started attempts current between refreshes.
  type ProgressRow = {
    examId: number;
    examTitle: string;
    totalQuestions: number;
    subjectId: number;
    subjectName: string;
    studentId: number;
    studentName: string;
    studentFirstName: string | null;
    studentLastName: string | null;
    studentAvatarData: string | null;
    studentEmail: string;
    status: "submitted" | "inprogress" | "notstarted";
    attemptId: number | null;
    answered: number | null;
    startedAt: Date | null;
    submittedAt: Date | null;
  };

  const progressRows: ProgressRow[] = [];
  for (const exam of publishedExams) {
    const enrolled = [...(enrollmentsBySubject.get(exam.subjectId) ?? [])].sort(
      (a, b) => a.user.name.localeCompare(b.user.name)
    );
    for (const enrollment of enrolled) {
      const attempt = resolvedAttempts.find(
        (item) => item.examId === exam.id && item.userId === enrollment.user.id
      );
      progressRows.push({
        examId: exam.id,
        examTitle: exam.title,
        totalQuestions: exam._count.questions,
        subjectId: exam.subjectId,
        subjectName: exam.subject.name,
        studentId: enrollment.user.id,
        studentName: enrollment.user.name,
        studentFirstName: enrollment.user.firstName,
        studentLastName: enrollment.user.lastName,
        studentAvatarData: enrollment.user.avatarData,
        studentEmail: enrollment.user.email,
        status: attempt?.submittedAt
          ? "submitted"
          : attempt
            ? "inprogress"
            : "notstarted",
        attemptId: attempt?.id ?? null,
        answered: attempt ? answeredByAttempt.get(attempt.id) ?? 0 : null,
        startedAt: attempt?.startedAt ?? null,
        submittedAt: attempt?.submittedAt ?? null,
      });
    }
  }

  // Filter options come from the rows themselves so a dropdown never offers a
  // subject or exam with no enrolled students.
  const subjectMap = new Map<number, string>();
  for (const row of progressRows) subjectMap.set(row.subjectId, row.subjectName);
  const subjectOptions = [...subjectMap]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const subjectFilter = subjectOptions.some((s) => s.id === Number(subjectParam))
    ? Number(subjectParam)
    : null;

  const examMap = new Map<number, string>();
  for (const row of progressRows) {
    if (subjectFilter !== null && row.subjectId !== subjectFilter) continue;
    examMap.set(row.examId, row.examTitle);
  }
  const examOptions = [...examMap]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // The exam dropdown is only meaningful under a chosen subject (it lists just
  // that subject's exams and is disabled otherwise), so an exam filter is
  // ignored — and never resurrected — when the subject is "All".
  const examFilter =
    subjectFilter !== null && examMap.has(Number(examParam))
      ? Number(examParam)
      : null;
  const statusFilter = STATUS_FILTERS.some((s) => s.value === statusParam)
    ? (statusParam as string)
    : "";

  const studentSearch = studentParam?.trim().toLowerCase() || "";

  const filteredProgress = progressRows.filter((row) => {
    if (studentSearch) {
      const nameMatch = row.studentName.toLowerCase().includes(studentSearch);
      const emailMatch = row.studentEmail.toLowerCase().includes(studentSearch);
      if (!nameMatch && !emailMatch) return false;
    }
    if (subjectFilter !== null && row.subjectId !== subjectFilter) return false;
    if (examFilter !== null && row.examId !== examFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  const progressTotal = filteredProgress.length;
  const progressTotalPages = Math.max(
    1,
    Math.ceil(progressTotal / PAGE_SIZE)
  );
  const progressPage = Math.min(
    Math.max(1, Number(pageParam) || 1),
    progressTotalPages
  );
  const progressPageRows = filteredProgress.slice(
    (progressPage - 1) * PAGE_SIZE,
    progressPage * PAGE_SIZE
  );

  const progressHref = (target: number) => {
    const params = new URLSearchParams();
    if (studentSearch) params.set("student", studentParam!);
    if (subjectFilter) params.set("subject", String(subjectFilter));
    if (examFilter) params.set("exam", String(examFilter));
    if (statusFilter) params.set("status", statusFilter);
    if (target > 1) params.set("pendingPage", String(target));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  const filterValues = {
    student: studentParam || "",
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
        <StatCard label="Students" value={students} icon={<IconUsers size={24} />} />
        <StatCard label="New" value={newStudents} icon={<IconUserX size={24} />} />
        <StatCard label="Subjects" value={subjects} icon={<IconBookOpen size={24} />} />
        <StatCard label="Exams" value={exams} icon={<IconClipboardList size={24} />} />
        <StatCard label="Draft exams" value={draftCount} icon={<IconPencil size={24} />} />
        <StatCard label="Attempts" value={attempts} icon={<IconCirclePlay size={24} />} />
      </div>

      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <CardHover
          as={Link}
          href="/admin/subjects"
          className="flex items-start gap-3 p-6 w-full"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconBookOpen size={24} />
          </span>
          <span className="min-w-0">
            <h2 className="font-medium text-slate-900">Manage subjects</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create subjects and enroll students into them.
            </p>
          </span>
        </CardHover>
        <CardHover
          as={Link}
          href="/admin/exams"
          className="flex items-start gap-3 p-6 w-full"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconClipboardList size={24} />
          </span>
          <span className="min-w-0">
            <h2 className="font-medium text-slate-900">Manage exams</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create timed exams and import question lists.
            </p>
          </span>
        </CardHover>
        <CardHover
          as={Link}
          href="/admin/quiz"
          className="flex items-start gap-3 p-6 w-full"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <IconHelpCircle size={24} />
          </span>
          <span className="min-w-0">
            <h2 className="font-medium text-slate-900">Manage quiz</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create quick quizzes with instant feedback.
            </p>
          </span>
        </CardHover>
      </div>

      <div className="flex flex-col">
      <section className="order-2 mt-10">
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
              <CardSoft as="li" key={exam.id} className="px-5 py-4">
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
                    <Badge
                      variant={
                        exam._count.questions === 0 ? "danger" : "success"
                      }
                    >
                      {exam._count.questions === 0
                        ? "Needs questions"
                        : "Ready to publish"}
                    </Badge>
                    <ButtonLink
                      href={`/admin/exams/${exam.id}`}
                      variant="secondary"
                      size="sm"
                    >
                      Manage
                    </ButtonLink>
                  </div>
                </div>
              </CardSoft>
            ))}
          </ul>
        )}
      </section>

      {progressRows.length > 0 ? (
        <section className="order-1 mt-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Test progress
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Live status for every enrolled student in your published tests.
                Progress updates automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Suspense fallback={<div className="h-16 w-full sm:w-44" />}>
                <ProgressSearch />
              </Suspense>
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
                resetParams={["exam"]}
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
                disabled={subjectFilter === null}
                allLabel={subjectFilter === null ? "Select a subject" : "All"}
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

          {progressTotal === 0 ? (
            <Card className="px-5 py-4 text-sm text-slate-500">
              No students match these filters.
            </Card>
          ) : (
            <Table className="table-fixed text-xs sm:text-sm">
              <TableHeader>
                <TableRow
                  hover={false}
                  className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  <TableHead className="w-[42%] px-3 py-3 sm:w-1/4 sm:px-5">
                    Student
                  </TableHead>
                  <TableHead className="w-[32%] px-3 py-3 sm:w-auto sm:px-5">
                    Exam
                  </TableHead>
                  <TableHead className="hidden px-5 py-3 sm:table-cell sm:w-auto">
                    Subject
                  </TableHead>
                  <TableHead className="w-[20%] px-2 py-3 sm:w-auto sm:px-5">
                    Status
                  </TableHead>
                  <TableHead className="hidden px-5 py-3 lg:table-cell lg:w-auto">
                    Started
                  </TableHead>
                  <TableHead className="hidden px-5 py-3 lg:table-cell lg:w-auto">
                    Ended
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progressPageRows.map((row) => (
                  <TableRow key={`${row.examId}:${row.studentId}`}>
                    <TableCell className="px-3 py-3 sm:px-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.studentName} firstName={row.studentFirstName} lastName={row.studentLastName} src={row.studentAvatarData} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">
                            {row.studentName}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {row.studentEmail}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 sm:px-5">
                      <Link
                        href={`/admin/exams/${row.examId}/report`}
                        className="block truncate font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {row.examTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden px-5 py-3 text-slate-500 sm:table-cell">
                      {row.subjectName}
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 py-3 sm:px-5">
                      {row.status === "inprogress" && row.attemptId !== null ? (
                        <AttemptLiveProgress
                          attemptId={row.attemptId}
                          examId={row.examId}
                          initialAnswered={row.answered ?? 0}
                          total={row.totalQuestions}
                        />
                      ) : row.status === "notstarted" ? (
                        <AttemptStartWatcher
                          examId={row.examId}
                          userId={row.studentId}
                        />
                      ) : (
                        <Badge
                          variant="success"
                          className="px-2 py-0 text-xs sm:text-sm"
                        >
                          Submitted
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden px-5 py-3 text-slate-500 lg:table-cell">
                      {row.startedAt ? formatDateTime(row.startedAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden px-5 py-3 text-slate-500 lg:table-cell">
                      {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {progressTotal > 0 ? (
            <div className="mt-3">
              <Pager
                page={progressPage}
                totalPages={progressTotalPages}
                total={progressTotal}
                pageSize={PAGE_SIZE}
                hrefFor={progressHref}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      </div>
    </>
  );
}
