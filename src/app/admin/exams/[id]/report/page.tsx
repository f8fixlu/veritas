import Link from "next/link";
import { notFound } from "next/navigation";
import AttemptLiveFlag from "@/components/admin/attempt-live-flag";
import AttemptLiveProgress from "@/components/admin/attempt-live-progress";
import AttemptStartWatcher from "@/components/admin/attempt-start-watcher";
import LiveStatusCards from "@/components/admin/attempt-status-cards";
import PrintButton from "@/components/admin/print-button";
import { IconFlag } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";

export const metadata = { title: "Exam report — Veritas Admin" };

type ReportRow = {
  userId: number;
  name: string;
  email: string;
  gender: string | null;
  status: "submitted" | "inprogress" | "notstarted";
  attemptId: number | null;
  answered: number | null;
  score: number | null;
  total: number | null;
  pct: number | null;
  submittedAt: Date | null;
  focusLosses: number | null;
  totalFocusLossMs: number | null;
  maxBlurMs: number | null;
  ip: string | null;
  userAgent: string | null;
};

const MEDALS = [
  "bg-amber-100 text-amber-800",
  "bg-slate-200 text-slate-700",
  "bg-orange-100 text-orange-800",
];

function statusBadge(status: ReportRow["status"]) {
  if (status === "submitted") {
    return (
      <span className="badge bg-emerald-50 text-emerald-700">Completed</span>
    );
  }
  if (status === "inprogress") {
    return <span className="badge bg-amber-50 text-amber-700">In progress</span>;
  }
  return <span className="badge bg-slate-100 text-slate-600">Not started</span>;
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
  return `${Math.round(ms / 1000)}s`;
}

function formatUserAgent(ua: string): { short: string; full: string } {
  const full = ua.trim();
  if (!full) return { short: "", full: "" };

  const browserMatch =
    full.match(/(Chrome|Firefox|Safari|Edg\/|Version\/|OPR\/|MSIE|Trident)/);
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
    short: `${browser} · ${os}`,
    full,
  };
}

function flagReasons(row: ReportRow): string[] {
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
  return reasons;
}

function flagsCell(row: ReportRow) {
  const reasons = flagReasons(row);
  if (reasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        <IconFlag size={12} /> None
      </span>
    );
  }
  return (
    <span
      className="inline-flex cursor-help items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
      title={reasons.join("\n")}
    >
      <IconFlag size={12} /> {reasons.length}
    </span>
  );
}

export default async function ExamReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const examId = Number((await params).id);
  if (!Number.isInteger(examId)) notFound();

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      subject: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });
  if (!exam) notFound();

  const enrollments = await db.enrollment.findMany({
    where: { subjectId: exam.subjectId },
    include: {
      user: { select: { id: true, name: true, email: true, gender: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const attempts = await db.attempt.findMany({
    where: { examId },
  });
  const attemptsByUser = new Map(attempts.map((a) => [a.userId, a]));
  const resolvedAttempts = await finalizeManyIfExpired(
    attempts.map((attempt) => ({
      attempt,
      durationMinutes: exam.durationMinutes,
    }))
  );
  const resolvedByUser = new Map(
    resolvedAttempts.map((a) => [a.userId, a])
  );

  const inProgressAttemptIds = resolvedAttempts
    .filter((a) => !a.submittedAt)
    .map((a) => a.id);
  const answeredGroups = inProgressAttemptIds.length
    ? await db.answer.groupBy({
        by: ["attemptId"],
        _count: { _all: true },
        where: {
          attemptId: { in: inProgressAttemptIds },
          selectedOption: { not: null },
        },
      })
    : [];
  const answeredByAttempt = new Map(
    answeredGroups.map((g) => [g.attemptId, g._count._all])
  );

  const rows: ReportRow[] = [];
  for (const enrollment of enrollments) {
    const attempt = attemptsByUser.get(enrollment.userId);
    const resolved = attempt ? resolvedByUser.get(enrollment.userId) : undefined;
    const submittedAt = resolved?.submittedAt ?? null;

    if (!attempt) {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "notstarted",
        attemptId: null,
        answered: null,
        score: null,
        total: null,
        pct: null,
        submittedAt: null,
        focusLosses: null,
        totalFocusLossMs: null,
        maxBlurMs: null,
        ip: null,
        userAgent: null,
      });
    } else if (submittedAt) {
      const pct = resolved?.total ? percent(resolved.score, resolved.total) : 0;
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "submitted",
        attemptId: resolved?.id ?? null,
        answered: null,
        score: resolved?.score ?? 0,
        total: resolved?.total ?? null,
        pct,
        submittedAt,
        focusLosses: resolved?.focusLosses ?? 0,
        totalFocusLossMs: resolved?.totalFocusLossMs ?? 0,
        maxBlurMs: resolved?.maxBlurMs ?? 0,
        ip: resolved?.ip ?? null,
        userAgent: resolved?.userAgent ?? null,
      });
    } else {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        gender: enrollment.user.gender,
        status: "inprogress",
        attemptId: attempt.id,
        answered: answeredByAttempt.get(attempt.id) ?? 0,
        score: null,
        total: null,
        pct: null,
        submittedAt: null,
        focusLosses: attempt.focusLosses ?? 0,
        totalFocusLossMs: attempt.totalFocusLossMs ?? 0,
        maxBlurMs: attempt.maxBlurMs ?? 0,
        ip: attempt.ip ?? null,
        userAgent: attempt.userAgent ?? null,
      });
    }
  }

  const maleRows = rows.filter((r) => r.gender === "MALE");
  const femaleRows = rows.filter((r) => r.gender === "FEMALE");
  const unspecifiedRows = rows.filter(
    (r) => r.gender !== "MALE" && r.gender !== "FEMALE"
  );

  const completed = rows.filter((r) => r.status === "submitted");
  const inProgress = rows.filter((r) => r.status === "inprogress");
  const notStarted = rows.filter((r) => r.status === "notstarted");

  const leaderboard = [...completed].sort(
    (a, b) =>
      (b.pct ?? 0) - (a.pct ?? 0) ||
      (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
  );

  const avgPct = completed.length
    ? Math.round(
        completed.reduce((sum, r) => sum + (r.pct ?? 0), 0) / completed.length
      )
    : null;
  const bestPct = completed.length
    ? Math.max(...completed.map((r) => r.pct ?? 0))
    : null;

  const statusInitial = {
    enrolled: rows.length,
    completed: completed.length,
    inProgress: inProgress.length,
    notStarted: notStarted.length,
  };

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
        <PrintButton />
      </div>

      {rows.length === 0 ? (
        <div className="card mt-6 p-12 text-center print:hidden">
          <h2 className="text-base font-semibold text-slate-900">
            No students enrolled
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enroll students into “{exam.subject.name}” to see results here.
          </p>
        </div>
      ) : (
        <>
          <LiveStatusCards
            examId={examId}
            initial={statusInitial}
            avgPct={avgPct}
            bestPct={bestPct}
          />

          {leaderboard.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                Leaderboard
              </h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 w-16">Rank</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3 hidden sm:table-cell">
                        Submitted
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, index) => (
                      <tr
                        key={row.userId}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              index < 3
                                ? MEDALS[index]
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-slate-900">
                            {row.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {row.email}
                          </span>
                        </td>
                        <td className="px-4 py-3">{scoreCell(row)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                          {row.submittedAt
                            ? formatDateTime(row.submittedAt)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <RosterSection title="Male" rows={maleRows} totalQuestions={exam._count.questions} examId={exam.id} />
          <RosterSection title="Female" rows={femaleRows} totalQuestions={exam._count.questions} examId={exam.id} />
          <RosterSection
            title="Unspecified"
            note="These accounts were created before gender was recorded."
            rows={unspecifiedRows}
            totalQuestions={exam._count.questions}
            examId={exam.id}
          />
        </>
      )}
    </>
  );
}

function RosterSection({
  title,
  note,
  rows,
  totalQuestions,
  examId,
}: {
  title: string;
  note?: string;
  rows: ReportRow[];
  totalQuestions: number;
  examId: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
        {title} ({rows.length})
      </h2>
      {note ? <p className="mb-3 text-xs text-slate-400">{note}</p> : null}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 hidden sm:table-cell">Submitted</th>
              <th className="px-4 py-3 hidden md:table-cell">IP</th>
              <th className="px-4 py-3 hidden md:table-cell">Browser</th>
              <th className="px-4 py-3 text-center">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const uaInfo = row.userAgent ? formatUserAgent(row.userAgent) : null;
              return (
              <tr
                key={row.userId}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-900">
                    {row.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {row.email}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.status === "inprogress" && row.attemptId !== null ? (
                    <AttemptLiveProgress
                      attemptId={row.attemptId}
                      initialAnswered={row.answered ?? 0}
                      total={totalQuestions}
                    />
                  ) : row.status === "notstarted" ? (
                    <AttemptStartWatcher examId={examId} userId={row.userId} />
                  ) : (
                    statusBadge(row.status)
                  )}
                </td>
                <td className="px-4 py-3">{scoreCell(row)}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                  {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500">
                  {row.ip ? row.ip : "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500">
                  {uaInfo ? (
                    <span title={uaInfo.full}>{uaInfo.short}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.status === "inprogress" && row.attemptId !== null ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AttemptLiveFlag attemptId={row.attemptId} />
                    </div>
                  ) : (
                    flagsCell(row)
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
