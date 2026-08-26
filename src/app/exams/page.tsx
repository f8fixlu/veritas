import Link from "next/link";
import NavBar from "@/components/nav-bar";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime, percent } from "@/lib/format";

export const metadata = { title: "My results — Veritas" };

function scoreBadgeClass(pct: number): string {
  if (pct >= 75) return "bg-emerald-50 text-emerald-700";
  if (pct >= 50) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export default async function ResultsPage() {
  const user = await requireUser();

  const db = getDb();
  const attempts = await db.attempt.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    include: {
      exam: { include: { subject: true } },
    },
  });

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          My results
        </h1>
        <p className="mt-1 text-sm text-slate-500">Every exam you have taken</p>

        {attempts.length === 0 ? (
          <div className="card mt-6 p-12 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              No attempts yet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Take an exam from your subjects page to see results here.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {attempts.map((attempt) => {
              const pct = percent(attempt.score, attempt.total);
              const done = Boolean(attempt.submittedAt);
              return (
                <li key={attempt.id} className="card px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-slate-900">
                        {attempt.exam.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {attempt.exam.subject.name} ·{" "}
                        {formatDateTime(attempt.submittedAt ?? attempt.startedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {done ? (
                        <>
                          <span
                            className={`badge ${scoreBadgeClass(pct)}`}
                          >
                            {`${attempt.score}/${attempt.total} \u00b7 ${pct}%`}
                          </span>
                          {attempt.exam.showResult ? (
                            <Link
                              href={`/result/${attempt.id}`}
                              className="btn btn-secondary btn-sm"
                            >
                              Review
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600">
                          In progress
                        </span>
                      )}
                      {!done ? (
                        <Link
                          href={`/attempt/${attempt.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Resume
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
