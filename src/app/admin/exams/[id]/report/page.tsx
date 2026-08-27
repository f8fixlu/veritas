import Link from "next/link";
import { notFound } from "next/navigation";
import AttemptLiveProgress from "@/components/admin/attempt-live-progress";
import PrintButton from "@/components/admin/print-button";
import {
  IconCircleCheck,
  IconCirclePlay,
  IconCircleSlash,
  IconPercent,
  IconTrophy,
  IconUsers,
} from "@/components/icons";
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

  const stats = [
    { label: "Enrolled", value: String(rows.length), icon: <IconUsers size={14} /> },
    { label: "Completed", value: String(completed.length), icon: <IconCircleCheck size={14} /> },
    { label: "In progress", value: String(inProgress.length), icon: <IconCirclePlay size={14} /> },
    { label: "Not started", value: String(notStarted.length), icon: <IconCircleSlash size={14} /> },
    {
      label: "Average score",
      value: avgPct === null ? "—" : `${avgPct}%`,
      icon: <IconPercent size={14} />,
    },
    {
      label: "Best score",
      value: bestPct === null ? "—" : `${bestPct}%`,
      icon: <IconTrophy size={14} />,
    },
  ];

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
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label} className="card px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                  <span className="text-indigo-500">{stat.icon}</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

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

          <RosterSection title="Male" rows={maleRows} totalQuestions={exam._count.questions} />
          <RosterSection title="Female" rows={femaleRows} totalQuestions={exam._count.questions} />
          <RosterSection
            title="Unspecified"
            note="These accounts were created before gender was recorded."
            rows={unspecifiedRows}
            totalQuestions={exam._count.questions}
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
}: {
  title: string;
  note?: string;
  rows: ReportRow[];
  totalQuestions: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
        {title} ({rows.length})
      </h2>
      {note ? <p className="mb-3 text-xs text-slate-400">{note}</p> : null}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 hidden sm:table-cell">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
                  ) : (
                    statusBadge(row.status)
                  )}
                </td>
                <td className="px-4 py-3">{scoreCell(row)}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                  {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
