import Link from "next/link";
import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeIfExpired } from "@/lib/exam";

export const metadata = { title: "Dashboard — Veritas" };

type ExamStatus =
  | { kind: "open" }
  | { kind: "active"; attemptId: number }
  | { kind: "done"; attemptId: number; score: number; total: number };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");

  const db = getDb();
  const subjects = await db.subject.findMany({
    where: { enrollments: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    include: {
      exams: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true } },
          sections: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  const myAttempts = await db.attempt.findMany({ where: { userId: user.id } });
  const attemptsByExam = new Map(myAttempts.map((a) => [a.examId, a]));

  async function statusFor(exam: {
    id: number;
    durationMinutes: number;
  }): Promise<ExamStatus> {
    const found = attemptsByExam.get(exam.id);
    if (!found) return { kind: "open" };
    const attempt = await finalizeIfExpired(found, exam.durationMinutes);
    if (attempt.submittedAt) {
      return {
        kind: "done",
        attemptId: attempt.id,
        score: attempt.score ?? 0,
        total: attempt.total ?? 0,
      };
    }
    return { kind: "active", attemptId: attempt.id };
  }

  const statuses = await Promise.all(
    subjects.flatMap((s) =>
      s.exams.map(async (exam) => ({
        subjectId: s.id,
        exam,
        status: await statusFor(exam),
      }))
    )
  );

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Exams from your enrolled subjects
          </p>
        </div>

        {subjects.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
              V
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              No subjects yet
            </h2>
            <p className="max-w-sm text-sm text-slate-500">
              You have not been enrolled in any subjects. Ask your teacher
              to add you to a subject.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {subjects.map((subject) => (
              <section key={subject.id}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                    {subject.name}
                  </h2>
                  {subject.description ? (
                    <p className="hidden truncate text-sm text-slate-500 sm:block">
                      {subject.description}
                    </p>
                  ) : null}
                </div>
                {subject.exams.length === 0 ? (
                  <div className="card px-5 py-4 text-sm text-slate-500">
                    No exams have been published for this subject yet.
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {subject.exams.map((exam) => {
                      const entry = statuses.find(
                        (e) => e.subjectId === subject.id && e.exam.id === exam.id
                      );
                      const status = entry?.status ?? { kind: "open" as const };
                      return (
                        <li
                          key={exam.id}
                          className="card flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <h3 className="truncate font-medium text-slate-900">
                              {exam.title}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {exam._count.questions} question
                              {exam._count.questions === 1 ? "" : "s"} ·{" "}
                              {exam.durationMinutes} min
                            </p>
                            {exam.sections.length > 0 ? (
                              <div className="mt-2 space-y-1 border-l-2 border-indigo-100 pl-3">
                                {exam.sections.map((section) => (
                                  <div key={section.id}>
                                    <p className="text-xs font-medium text-slate-700">
                                      {section.name} ·{" "}
                                      <span className="font-normal">
                                        {section.pointsPerQuestion} pt
                                        {section.pointsPerQuestion === 1 ? "" : "s"}
                                        /question
                                      </span>
                                    </p>
                                    {section.details ? (
                                      <p className="text-xs text-slate-500">
                                        {section.details}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            {status.kind === "done" ? (
                              <>
                                <span className="badge bg-emerald-50 text-emerald-700">
                                  {`${status.score}/${status.total} \u00b7 ${Math.round(
                                    (100 * status.score) / Math.max(1, status.total)
                                  )}%`}
                                </span>
                                {exam.showResult ? (
                                  <Link
                                    href={`/result/${status.attemptId}`}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    View result
                                  </Link>
                                ) : null}
                              </>
                            ) : status.kind === "active" ? (
                              <>
                                <span className="badge bg-amber-50 text-amber-700">
                                  In progress
                                </span>
                                <Link
                                  href={`/attempt/${status.attemptId}`}
                                  className="btn btn-primary btn-sm"
                                >
                                  Resume
                                </Link>
                              </>
                            ) : (
                              <>
                                <span className="badge bg-slate-100 text-slate-600">
                                  Open
                                </span>
                                <Link
                                  href={`/exam/${exam.id}`}
                                  className="btn btn-primary btn-sm"
                                >
                                  Take exam
                                </Link>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
