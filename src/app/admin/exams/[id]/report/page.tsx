import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/print-button";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeIfExpired } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";

export const metadata = { title: "Exam report — Veritas Admin" };

type ReportRow = {
  userId: number;
  name: string;
  email: string;
  status: "submitted" | "inprogress" | "notstarted";
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
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const rows: ReportRow[] = [];
  for (const enrollment of enrollments) {
    let attempt = await db.attempt.findUnique({
      where: { examId_userId: { examId, userId: enrollment.userId } },
    });
    let submittedAt: Date | null = null;
    if (attempt) {
      const resolved = await finalizeIfExpired(attempt, exam.durationMinutes);
      submittedAt = resolved.submittedAt;
    }

    if (!attempt) {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        status: "notstarted",
        score: null,
        total: null,
        pct: null,
        submittedAt: null,
      });
    } else if (submittedAt) {
      const pct = attempt?.total ? percent(attempt.score, attempt.total) : 0;
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        status: "submitted",
        score: attempt?.score ?? 0,
        total: attempt?.total ?? null,
        pct,
        submittedAt,
      });
    } else {
      rows.push({
        userId: enrollment.userId,
        name: enrollment.user.name,
        email: enrollment.user.email,
        status: "inprogress",
        score: null,
        total: null,
        pct: null,
        submittedAt: null,
      });
    }
  }

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
    { label: "Enrolled", value: String(rows.length) },
    { label: "Completed", value: String(completed.length) },
    { label: "In progress", value: String(inProgress.length) },
    { label: "Not started", value: String(notStarted.length) },
    { label: "Average score", value: avgPct === null ? "—" : `${avgPct}%` },
    { label: "Best score", value: bestPct === null ? "—" : `${bestPct}%` },
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
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {stat.label}
                </p>
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

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
              All students ({rows.length})
            </h2>
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
                      <td className="px-4 py-3">{statusBadge(row.status)}</td>
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
        </>
      )}
    </>
  );
}
