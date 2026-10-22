import Link from "next/link";
import { notFound } from "next/navigation";
import ActionMenu from "@/components/admin/action-menu";
import AttemptLiveFlag from "@/components/admin/attempt-live-flag";
import AttemptLiveProgress from "@/components/admin/attempt-live-progress";
import AttemptPhotosButton from "@/components/admin/attempt-photos-button";
import AttemptResultButton from "@/components/admin/attempt-result-button";
import AttemptStartWatcher from "@/components/admin/attempt-start-watcher";
import LiveStatusCards from "@/components/admin/attempt-status-cards";
import AttemptTimeRemaining from "@/components/admin/attempt-time-remaining";
import FilterSelect, {
  type FilterOption,
} from "@/components/admin/filter-select";
import PrintButton from "@/components/admin/print-button";
import ReportSearch from "@/components/admin/report-search";
import ExportButton from "@/components/admin/export-button";
import { IconFlag } from "@/components/icons";
import { Avatar, Badge, Card } from "@/app/ui";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { Suspense } from "react";
import { formatDateTime, percent } from "@/lib/format";
import { isAdmin, ownedExamWhere } from "@/lib/scope";

export const metadata = { title: "Exam report — Veritas Admin" };

type ReportRow = {
  userId: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  avatarData: string | null;
  email: string;
  gender: string | null;
  status: "submitted" | "inprogress" | "notstarted";
  attemptId: number | null;
  answered: number | null;
  score: number | null;
  total: number | null;
  pct: number | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  focusLosses: number | null;
  totalFocusLossMs: number | null;
  maxBlurMs: number | null;
  ip: string | null;
  userAgent: string | null;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  screenSurface: string | null;
  cameraLabel: string | null;
  virtualCamera: boolean;
  snapshotCount: number;
  screenSnapshotCount: number;
};

const MEDALS = [
  "bg-amber-100 text-amber-800",
  "bg-slate-200 text-slate-700",
  "bg-orange-100 text-orange-800",
];

const LEADERBOARD_SIZE = 10;

const STATUS_FILTERS: FilterOption[] = [
  { value: "submitted", label: "Completed" },
  { value: "inprogress", label: "In progress" },
  { value: "notstarted", label: "Not started" },
];

const GENDER_FILTERS: FilterOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Unspecified" },
];

function statusBadge(status: ReportRow["status"]) {
  if (status === "submitted") {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === "inprogress") {
    return <Badge variant="warning">In progress</Badge>;
  }
  return <Badge variant="slate">Not started</Badge>;
}

function genderBadge(gender: string | null) {
  if (gender === "MALE") {
    return <span className="badge bg-sky-50 text-sky-700">Male</span>;
  }
  if (gender === "FEMALE") {
    return <span className="badge bg-pink-50 text-pink-700">Female</span>;
  }
  return <span className="text-slate-400">—</span>;
}

function scoreCell(row: ReportRow) {
  if (row.status !== "submitted") return <span className="text-slate-400">—</span>;
  const pct = row.pct ?? 0;
  const tone =
    pct >= 75
      ? "text-emerald-700"
      : pct >= 50
        ? "text-amber-700"
        : "text-red-700";
  return (
    <span className="font-medium">
      {row.score}/{row.total}
      <span className={`ml-2 ${tone}`}>{pct}%</span>
    </span>
  );
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function elapsedCaption(startedAt: Date, submittedAt: Date): string {
  return fmtDuration(submittedAt.getTime() - startedAt.getTime());
}

function lapseCaption(
  startedAt: Date,
  submittedAt: Date,
  durationMinutes: number
): string {
  const elapsedMs = Math.max(0, submittedAt.getTime() - startedAt.getTime());
  const elapsed = fmtDuration(elapsedMs);
  // Time consumed vs. the exam length. Guard a missing/zero duration so the
  // cell can never render "NaN%" / "Infinity%".
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return elapsed;
  const percentage = Math.round((elapsedMs / (durationMinutes * 60 * 1000)) * 100);
  return `${elapsed} (${percentage}%)`;
}

function formatUserAgent(ua: string): {
  browser: string;
  os: string;
  short: string;
  full: string;
} {
  const full = ua.trim();
  if (!full) return { browser: "Other", os: "Other", short: "", full };

  const browserMatch = full.match(
    /(Chrome|Firefox|Safari|Edg\/|Version\/|OPR\/|MSIE|Trident)/
  );
  let browser = "Browser";
  if (/Edg\//.test(full)) browser = "Edge";
  else if (/OPR\//.test(full)) browser = "Opera";
  else if (/Firefox/.test(full)) browser = "Firefox";
  else if (/Trident|MSIE/.test(full)) browser = "IE";
  else if (/Chrome/.test(full)) browser = "Chrome";
  else if (browserMatch) browser = browserMatch[1].replace("Version/", "Safari");

  const osMatch = full.match(
    /(Windows NT [\d.]+|Android [\d.]+|iPhone OS [\d_]+|Mac OS X [\d_.]+|Linux|iPad OS [\d_]+)/
  );
  let os = "Other";
  if (osMatch) {
    const raw = osMatch[1];
    if (raw.startsWith("Windows")) {
      const ver = raw.match(/NT (\d+)/)?.[1];
      const names: Record<string, string> = {
        "10": "Windows 10/11",
        "6.3": "Windows 8.1",
        "6.2": "Windows 8",
        "6.1": "Windows 7",
        "6.0": "Windows Vista",
        "5.1": "Windows XP",
      };
      os = names[ver ?? ""] ?? "Windows";
    } else if (raw.startsWith("iPhone")) {
      os = "iPhone";
    } else if (raw.startsWith("iPad")) {
      os = "iPad";
    } else if (raw.startsWith("Mac OS X")) {
      os = "macOS";
    }
  }

  return {
    browser,
    os,
    short: `${browser} · ${os}`,
    full,
  };
}

function flagReasons(
  row: ReportRow,
  requireCamera: boolean,
  requireScreenCapture: boolean
): string[] {
  const reasons: string[] = [];
  if (row.focusLosses && row.focusLosses >= 3) {
    reasons.push(`Left the page ${row.focusLosses} times`);
  }
  if (row.maxBlurMs && row.maxBlurMs >= 30_000) {
    reasons.push(`Away for ${fmtDuration(row.maxBlurMs)} at once`);
  }
  if (row.focusLosses && row.totalFocusLossMs && row.totalFocusLossMs >= 60_000) {
    reasons.push(`Away ${fmtDuration(row.totalFocusLossMs)} in total`);
  }
  if (requireCamera && !row.cameraEnabled) {
    reasons.push("Webcam was never enabled");
  } else if (requireCamera && row.snapshotCount === 0) {
    reasons.push("No webcam snapshots captured");
  }
  if (requireScreenCapture && !row.screenEnabled) {
    reasons.push("Screen sharing was never enabled");
  } else if (requireScreenCapture && row.screenSnapshotCount === 0) {
    reasons.push("No screen snapshots captured");
  }
  if (
    requireScreenCapture &&
    row.screenSurface &&
    row.screenSurface !== "monitor"
  ) {
    reasons.push(
      row.screenSurface === "browser"
        ? "Shared a browser tab, not the entire screen"
        : "Shared a window, not the entire screen"
    );
  }
  if (row.virtualCamera) {
    reasons.push(
      row.cameraLabel
        ? `Virtual camera detected: ${row.cameraLabel}`
        : "Virtual camera detected"
    );
  }
  return reasons;
}

function flagsCell(
  row: ReportRow,
  requireCamera: boolean,
  requireScreenCapture: boolean
) {
  const reasons = flagReasons(row, requireCamera, requireScreenCapture);
  if (reasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        <IconFlag size={16} /> None
      </span>
    );
  }
  return (
    <span
      className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
      title={reasons.join("\n")}
    >
      <IconFlag size={16} /> {reasons.length}
    </span>
  );
}

export default async function ExamReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    gender?: string;
    browser?: string;
    q?: string;
    lq?: string;
    page?: string;
  }>;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) notFound();
  const examId = Number((await params).id);
  if (!Number.isInteger(examId)) notFound();

  const { status: statusParam, gender: genderParam, browser: browserParam, q: studentQuery, lq: leaderboardQuery, page: pageParam } =
    await searchParams;

  const db = getDb();
  const exam = await db.exam.findFirst({
    where: { id: examId, ...ownedExamWhere(user) },
    include: {
      subject: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });
  if (!exam) notFound();

  const enrollments = await db.enrollment.findMany({
    where: { subjectId: exam.subjectId },
    include: {
      user: { select: { id: true, name: true, firstName: true, lastName: true, avatarData: true, email: true, gender: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const attempts = await db.attempt.findMany({
    where: { examId },
  });
  const attemptsByUser = new Map(
    attempts.map((attempt) => [attempt.userId, attempt])
  );
  const resolvedAttempts = await finalizeManyIfExpired(
    attempts.map((attempt) => ({
      attempt,
      durationMinutes: exam.durationMinutes,
    }))
  );
  const resolvedByUser = new Map(
    resolvedAttempts.map((attempt) => [attempt.userId, attempt])
  );

  const answeredByAttempt = new Map<number, number>();
  const inProgressAttemptIds = resolvedAttempts
    .filter((attempt) => !attempt.submittedAt)
    .map((attempt) => attempt.id);
  if (inProgressAttemptIds.length > 0) {
    const answeredGroups = await db.answer.groupBy({
      by: ["attemptId"],
      where: {
        attemptId: { in: inProgressAttemptIds },
        selectedOption: { not: null },
      },
      _count: { _all: true },
    });
    for (const group of answeredGroups) {
      if (group.attemptId !== null) {
        answeredByAttempt.set(group.attemptId, group._count._all);
      }
    }
  }

  const snapshotCounts = new Map<number, number>();
  const screenSnapshotCounts = new Map<number, number>();
  if (resolvedAttempts.length > 0) {
    const snapshotGroups = await db.attemptSnapshot.groupBy({
      by: ["attemptId"],
      where: { attemptId: { in: resolvedAttempts.map((a) => a.id) } },
      _count: { _all: true },
    });
    for (const group of snapshotGroups) {
      snapshotCounts.set(group.attemptId, group._count._all);
    }

    const screenSnapshotGroups = await db.attemptSnapshot.groupBy({
      by: ["attemptId"],
      where: {
        attemptId: { in: resolvedAttempts.map((a) => a.id) },
        source: "SCREEN",
      },
      _count: { _all: true },
    });
    for (const group of screenSnapshotGroups) {
      screenSnapshotCounts.set(group.attemptId, group._count._all);
    }
  }

  const rows: ReportRow[] = [];
  for (const enrollment of enrollments) {
    const attempt = attemptsByUser.get(enrollment.userId);
    const resolved = attempt
      ? resolvedByUser.get(enrollment.userId)
      : undefined;
    const submittedAt = resolved?.submittedAt ?? null;

    if (!attempt) {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        firstName: enrollment.user.firstName,
        lastName: enrollment.user.lastName,
        avatarData: enrollment.user.avatarData,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "notstarted",
        attemptId: null,
        answered: null,
        score: null,
        total: null,
        pct: null,
        startedAt: null,
        submittedAt: null,
        focusLosses: null,
        totalFocusLossMs: null,
        maxBlurMs: null,
        ip: null,
        userAgent: null,
        cameraEnabled: false,
        screenEnabled: false,
        screenSurface: null,
        cameraLabel: null,
        virtualCamera: false,
        snapshotCount: 0,
        screenSnapshotCount: 0,
      });
    } else if (submittedAt) {
      const pct = resolved?.total ? percent(resolved.score, resolved.total) : 0;
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        firstName: enrollment.user.firstName,
        lastName: enrollment.user.lastName,
        avatarData: enrollment.user.avatarData,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "submitted",
        attemptId: resolved?.id ?? null,
        answered: null,
        score: resolved?.score ?? 0,
        total: resolved?.total ?? null,
        pct,
        startedAt: resolved?.startedAt ?? null,
        submittedAt,
        focusLosses: resolved?.focusLosses ?? 0,
        totalFocusLossMs: resolved?.totalFocusLossMs ?? 0,
        maxBlurMs: resolved?.maxBlurMs ?? 0,
        ip: resolved?.ip ?? null,
        userAgent: resolved?.userAgent ?? null,
        cameraEnabled: resolved?.cameraEnabled ?? false,
        screenEnabled: resolved?.screenEnabled ?? false,
        screenSurface: resolved?.screenSurface ?? null,
        cameraLabel: resolved?.cameraLabel ?? null,
        virtualCamera: resolved?.virtualCamera ?? false,
        snapshotCount: snapshotCounts.get(resolved?.id ?? -1) ?? 0,
        screenSnapshotCount: screenSnapshotCounts.get(resolved?.id ?? -1) ?? 0,
      });
    } else {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        firstName: enrollment.user.firstName,
        lastName: enrollment.user.lastName,
        avatarData: enrollment.user.avatarData,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "inprogress",
        attemptId: attempt.id,
        answered: answeredByAttempt.get(attempt.id) ?? 0,
        score: null,
        total: null,
        pct: null,
        startedAt: attempt.startedAt,
        submittedAt: null,
        focusLosses: attempt.focusLosses ?? 0,
        totalFocusLossMs: attempt.totalFocusLossMs ?? 0,
        maxBlurMs: attempt.maxBlurMs ?? 0,
        ip: attempt.ip ?? null,
        userAgent: attempt.userAgent ?? null,
        cameraEnabled: attempt.cameraEnabled ?? false,
        screenEnabled: attempt.screenEnabled ?? false,
        screenSurface: attempt.screenSurface ?? null,
        cameraLabel: attempt.cameraLabel ?? null,
        virtualCamera: attempt.virtualCamera ?? false,
        snapshotCount: snapshotCounts.get(attempt.id) ?? 0,
        screenSnapshotCount: screenSnapshotCounts.get(attempt.id) ?? 0,
      });
    }
  }

  // Leaderboard: filter by lq param (independent from students table)
  const leaderboardFilteredRows = leaderboardQuery
    ? rows.filter((row) => {
        const lq = leaderboardQuery.trim().toLowerCase();
        return (
          row.name.toLowerCase().includes(lq) ||
          row.email.toLowerCase().includes(lq)
        );
      })
    : rows;

  const completed = leaderboardFilteredRows.filter((row) => row.status === "submitted");
  const inProgress = leaderboardFilteredRows.filter((row) => row.status === "inprogress");
  const notStarted = leaderboardFilteredRows.filter((row) => row.status === "notstarted");

  // Students table: filter by q param (does NOT affect leaderboard)
  const studentFilteredRows = studentQuery
    ? rows.filter((row) => {
        const q = studentQuery.trim().toLowerCase();
        return (
          row.name.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q)
        );
      })
    : rows;

  const leaderboard = [...completed].sort(
    (a, b) =>
      (b.pct ?? 0) - (a.pct ?? 0) ||
      (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
  );

  // Server-side pagination for leaderboard
  const totalPages = Math.max(1, Math.ceil(leaderboard.length / LEADERBOARD_SIZE));
  const currentPage = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);
  const leaderboardPage = leaderboard.slice(
    (currentPage - 1) * LEADERBOARD_SIZE,
    currentPage * LEADERBOARD_SIZE
  );

  const avgPct = completed.length
    ? Math.round(
        completed.reduce((sum, row) => sum + (row.pct ?? 0), 0) /
          completed.length
      )
    : null;
  const bestPct = completed.length
    ? Math.max(...completed.map((row) => row.pct ?? 0))
    : null;

  const statusInitial = {
    enrolled: leaderboardFilteredRows.length,
    completed: completed.length,
    inProgress: inProgress.length,
    notStarted: notStarted.length,
  };

  // Roster filters (status / gender / browser), all defaulting to "all".
  const browsers = Array.from(
    new Set(
      rows
        .map((row) =>
          row.userAgent ? formatUserAgent(row.userAgent).browser : null
        )
        .filter((browser): browser is string => Boolean(browser))
    )
  ).sort((a, b) => a.localeCompare(b));

  const statusFilter = STATUS_FILTERS.some((o) => o.value === statusParam)
    ? statusParam!
    : "";
  const genderFilter = GENDER_FILTERS.some((o) => o.value === genderParam)
    ? genderParam!
    : "";
  const browserFilter = browsers.includes(browserParam ?? "")
    ? browserParam!
    : "";

  const filteredRows = studentFilteredRows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (genderFilter === "male" && row.gender !== "MALE") return false;
    if (genderFilter === "female" && row.gender !== "FEMALE") return false;
    if (
      genderFilter === "unspecified" &&
      (row.gender === "MALE" || row.gender === "FEMALE")
    ) {
      return false;
    }
    if (browserFilter) {
      const browser = row.userAgent
        ? formatUserAgent(row.userAgent).browser
        : null;
      if (browser !== browserFilter) return false;
    }
    return true;
  });

  const reportHref = `/admin/exams/${examId}/report`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/exams/${examId}`}
            className="text-sm text-indigo-600 hover:text-indigo-500 print:hidden"
          >
            ← Back to exam
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Exam report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {exam.title} · {exam.subject.name} · {exam.durationMinutes} min ·{" "}
            {exam._count.questions} question{exam._count.questions === 1 ? "" : "s"}
          </p>
          <p className="print-only mt-1 text-xs text-slate-500">
            Generated {formatDateTime(new Date())}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ExportButton />
          <PrintButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6 p-12 text-center print:hidden">
          <h2 className="text-base font-semibold text-slate-900">
            No students enrolled
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enroll students into &ldquo;{exam.subject.name}&rdquo; to see results here.
          </p>
        </Card>
      ) : (
        <>
          <LiveStatusCards
            examId={examId}
            initial={statusInitial}
            avgPct={avgPct}
            bestPct={bestPct}
          />

          {leaderboard.length > 0 || Boolean(leaderboardQuery) ? (
            <section className="mt-8">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Leaderboard
                </h2>
                <span className="text-xs text-slate-500">
                  {leaderboard.length > LEADERBOARD_SIZE
                    ? `Showing ${(currentPage - 1) * LEADERBOARD_SIZE + 1}–${Math.min(
                        currentPage * LEADERBOARD_SIZE,
                        leaderboard.length
                      )} of ${leaderboard.length}`
                    : `${leaderboard.length} student${leaderboard.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="mb-3">
                <Suspense>
                  <ReportSearch param="lq" basePath={reportHref} />
                </Suspense>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="w-14 px-3 py-3 sm:w-16 sm:px-4">Rank</th>
                      <th className="w-[44%] px-3 py-3 sm:w-[34%] sm:px-4">
                        Student
                      </th>
                      <th className="w-[28%] px-3 py-3 sm:w-[14%] sm:px-4">
                        Score
                      </th>
                      <th className="hidden px-4 py-3 sm:table-cell sm:w-[15%]">
                        Started
                      </th>
                      <th className="hidden px-4 py-3 lg:table-cell lg:w-[15%]">
                        Submitted
                      </th>
                      <th className="hidden px-4 py-3 lg:table-cell lg:w-[14%]">
                        Lapse
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardPage.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-sm text-slate-500"
                        >
                          No students match this search.
                        </td>
                      </tr>
                    ) : (
                      leaderboardPage.map((row, index) => {
                        const rank =
                          (currentPage - 1) * LEADERBOARD_SIZE + index + 1;
                        return (
                          <tr
                            key={row.userId}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="px-3 py-3 sm:px-4">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  rank <= 3
                                    ? MEDALS[rank - 1]
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {rank}
                              </span>
                            </td>
                            <td className="px-3 py-3 sm:px-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={row.name} firstName={row.firstName} lastName={row.lastName} src={row.avatarData} />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-slate-900">
                                    {row.name}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {row.email}
                                  </span>
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 sm:px-4">{scoreCell(row)}</td>
                            <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                              {row.startedAt
                                ? formatDateTime(row.startedAt)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                              {row.submittedAt
                                ? formatDateTime(row.submittedAt)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                              {row.startedAt && row.submittedAt
                                ? lapseCaption(row.startedAt, row.submittedAt, exam.durationMinutes)
                                : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Leaderboard pagination */}
              {totalPages > 1 ? (
                <div className="mt-3 flex items-center justify-between">
                  <a
                    href={`${reportHref}?status=${statusParam}&gender=${genderParam}&browser=${browserParam}${leaderboardQuery ? `&lq=${encodeURIComponent(leaderboardQuery)}` : ""}&page=${currentPage - 1}`}
                    className={`btn btn-secondary btn-sm ${currentPage <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  >
                    &larr; Previous
                  </a>
                  <span className="text-xs text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <a
                    href={`${reportHref}?status=${statusParam}&gender=${genderParam}&browser=${browserParam}${leaderboardQuery ? `&lq=${encodeURIComponent(leaderboardQuery)}` : ""}&page=${currentPage + 1}`}
                    className={`btn btn-secondary btn-sm ${currentPage >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Next &rarr;
                  </a>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Students{" "}
                <span className="text-slate-400">({filteredRows.length})</span>
              </h2>
              <div className="flex flex-wrap items-end gap-3 print:hidden">
                <Suspense>
                  <ReportSearch param="q" basePath={reportHref} />
                </Suspense>
                <FilterSelect
                  param="status"
                  label="Status"
                  value={statusFilter}
                  options={STATUS_FILTERS}
                  basePath={reportHref}
                  filters={{ gender: genderFilter, browser: browserFilter }}
                  className="w-full sm:w-40"
                />
                <FilterSelect
                  param="gender"
                  label="Gender"
                  value={genderFilter}
                  options={GENDER_FILTERS}
                  basePath={reportHref}
                  filters={{ status: statusFilter, browser: browserFilter }}
                  className="w-full sm:w-40"
                />
                <FilterSelect
                  param="browser"
                  label="Browser"
                  value={browserFilter}
                  options={browsers.map((browser) => ({
                    value: browser,
                    label: browser,
                  }))}
                  basePath={reportHref}
                  filters={{ status: statusFilter, gender: genderFilter }}
                  className="w-full sm:w-40"
                />
              </div>
            </div>

            <RosterTable
              rows={filteredRows}
              totalQuestions={exam._count.questions}
              totalDurationMinutes={exam.durationMinutes}
              examId={exam.id}
              requireCamera={exam.requireCamera}
              requireScreenCapture={exam.requireScreenCapture}
              emptyMessage={
                studentQuery
                  ? "No students match this search."
                  : "No students match these filters."
              }
            />
          </section>
        </>
      )}
    </>
  );
}

function RosterTable({
  rows,
  totalQuestions,
  totalDurationMinutes,
  examId,
  requireCamera,
  requireScreenCapture,
  emptyMessage = "No students to show.",
}: {
  rows: ReportRow[];
  totalQuestions: number;
  totalDurationMinutes: number;
  examId: number;
  requireCamera: boolean;
  requireScreenCapture: boolean;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <table className="w-full table-fixed text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="w-[44%] px-3 py-3 sm:w-[34%] sm:px-4 md:w-[30%] lg:w-[26%]">Student</th>
            <th className="hidden px-4 py-3 sm:table-cell sm:w-[12%] md:w-[10%] lg:w-[7%]">Gender</th>
            <th className="w-[32%] px-2 py-3 sm:w-[16%] sm:px-4 md:w-[13%] lg:w-[10%]">Status</th>
            <th className="w-[20%] px-2 py-3 sm:w-[16%] sm:px-4 md:w-[13%] lg:w-[10%]">Score</th>
            <th className="hidden px-4 py-3 md:table-cell md:w-[18%] lg:w-[15%]">Submitted</th>
            <th className="hidden px-4 py-3 lg:table-cell lg:w-[11%]">IP</th>
            <th className="hidden px-4 py-3 lg:table-cell lg:w-[14%]">Browser</th>
            <th className="hidden px-4 py-3 text-center sm:table-cell sm:w-[10%] md:w-[9%] lg:w-[7%]">Flags</th>
            <th className="w-10 px-1 py-3 text-center sm:w-12 sm:px-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const uaInfo = row.userAgent
              ? formatUserAgent(row.userAgent)
              : null;
            const hasResult =
              row.status === "submitted" && row.attemptId !== null;
            const hasPhotos =
              row.attemptId !== null && row.snapshotCount > 0;
            return (
              <tr
                key={row.userId}
                className="transition-colors hover:bg-slate-50/60"
              >
                <td className="px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.name} firstName={row.firstName} lastName={row.lastName} src={row.avatarData} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900" title={row.name}>
                        {row.name}
                      </span>
                      <span
                        className="block truncate text-xs text-slate-500"
                        title={`${row.name} (${row.email})`}
                      >
                        {row.email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {genderBadge(row.gender)}
                </td>
                <td className="px-2 py-3 sm:whitespace-nowrap sm:px-4">
                  {row.status === "inprogress" && row.attemptId !== null ? (
                    <div className="space-y-1">
                      <AttemptLiveProgress
                        attemptId={row.attemptId}
                        examId={examId}
                        initialAnswered={row.answered ?? 0}
                        total={totalQuestions}
                      />
                      <AttemptTimeRemaining
                        startedAt={row.startedAt}
                        durationMinutes={totalDurationMinutes}
                      />
                    </div>
                  ) : row.status === "notstarted" ? (
                    <AttemptStartWatcher examId={examId} userId={row.userId} />
                  ) : (
                    statusBadge(row.status)
                  )}
                </td>
                <td className="px-2 py-3 sm:px-4">{scoreCell(row)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500">
                  {row.submittedAt ? (
                    <>
                      <span className="block">
                        {formatDateTime(row.submittedAt)}
                      </span>
                      {row.startedAt ? (
                        <span className="block text-xs text-slate-400">
                          took {elapsedCaption(row.startedAt, row.submittedAt)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                  {row.ip ? (
                    <span className="block truncate" title={row.ip}>
                      {row.ip.length > 20 ? `${row.ip.slice(0, 20)}…` : row.ip}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                  {uaInfo ? (
                    <span title={uaInfo.full}>{uaInfo.short}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  {row.status === "inprogress" && row.attemptId !== null ? (
                    <div className="flex justify-center">
                      <AttemptLiveFlag attemptId={row.attemptId} examId={examId} />
                    </div>
                  ) : (
                    flagsCell(row, requireCamera, requireScreenCapture)
                  )}
                </td>
                <td className="px-1 py-3 text-center sm:px-4">
                  {hasResult || hasPhotos ? (
                    <div className="flex justify-center">
                      <ActionMenu label={`Actions for ${row.name}`}>
                        {hasResult ? (
                          <AttemptResultButton attemptId={row.attemptId!} menuItem />
                        ) : null}
                        {hasPhotos ? (
                          <AttemptPhotosButton
                            attemptId={row.attemptId!}
                            menuItem
                          />
                        ) : null}
                      </ActionMenu>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}