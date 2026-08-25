import { notFound, redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime, nowMs, percent } from "@/lib/format";

export const metadata = { title: "Result — Veritas" };

const LETTERS = ["A", "B", "C", "D"] as const;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const attemptId = Number((await params).id);
  if (!Number.isInteger(attemptId)) notFound();

  const db = getDb();
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          subject: true,
          questions: {
            orderBy: { order: "asc" },
            include: { section: { select: { pointsPerQuestion: true } } },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt || (attempt.userId !== user.id && user.role !== "ADMIN")) notFound();

  let submittedAt = attempt.submittedAt;
  if (!submittedAt) {
    const endsAt = new Date(
      attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60_000
    );
    if (nowMs() < endsAt.getTime()) redirect(`/attempt/${attempt.id}`);
    const ppq = attempt.exam.pointsPerQuestion;
    const totalPoints = attempt.exam.questions.reduce(
      (sum, q) => sum + (q.section?.pointsPerQuestion ?? ppq),
      0
    );
    await db.attempt.update({
      where: { id: attempt.id },
      data: {
        submittedAt: endsAt,
        score: 0,
        total: totalPoints,
      },
    });
    submittedAt = endsAt;
  }

  const justFinalized = !attempt.submittedAt;
  const score = justFinalized ? 0 : (attempt.score ?? 0);
  const total = attempt.total ?? attempt.exam.questions.length;

  const answersByQuestion = new Map(
    attempt.answers.map((a) => [a.questionId, a])
  );

  const pct = percent(score, total);
  const gradeColor =
    pct >= 75
      ? "text-emerald-600"
      : pct >= 50
        ? "text-amber-600"
        : "text-red-600";

  const canView = attempt.exam.showResult || user.role === "ADMIN";

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card p-8 text-center">
          <p className="badge mx-auto bg-indigo-50 text-indigo-700">
            {attempt.exam.subject.name}
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            {attempt.exam.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Submitted {submittedAt ? formatDateTime(submittedAt) : ""}
          </p>
          <div className="mt-6 flex items-end justify-center gap-2">
            <span className={`text-5xl font-bold tracking-tight ${gradeColor}`}>
              {score}
            </span>
            <span className="pb-1.5 text-2xl font-medium text-slate-400">
              / {total}
            </span>
          </div>
          <p className={`mt-1 text-sm font-medium ${gradeColor}`}>
            {`${pct}% correct`}
          </p>
          {!canView ? (
            <p className="mt-4 text-xs text-slate-400">
              The full answer review has not been released yet.
            </p>
          ) : null}
        </div>

        {canView ? (
          <>
            <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight text-slate-900">
              Question review
            </h2>
        <ul className="space-y-4">
          {attempt.exam.questions.map((question, index) => {
            const answer = answersByQuestion.get(question.id);
            const selected = answer?.selectedOption ?? null;
            return (
              <li key={question.id} className="card p-5">
                <h3 className="font-medium leading-relaxed text-slate-900">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  {question.text}
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {LETTERS.map((letter) => {
                    const value = question[`option${letter}` as const];
                    const isCorrect = question.correctOption === letter;
                    const isPicked = selected === letter;
                    let cls =
                      "border-slate-200 bg-white text-slate-700";
                    if (isCorrect) {
                      cls = "border-emerald-300 bg-emerald-50 text-emerald-800";
                    } else if (isPicked) {
                      cls = "border-red-300 bg-red-50 text-red-800";
                    }
                    return (
                      <div
                        key={letter}
                        className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                            isCorrect
                              ? "border-emerald-500 bg-emerald-600 text-white"
                              : isPicked
                                ? "border-red-400 bg-red-500 text-white"
                                : "border-slate-300 text-slate-500"
                          }`}
                        >
                          {letter}
                        </span>
                        <span>{value}</span>
                        {isPicked && !isCorrect ? (
                          <span className="ml-auto mt-0.5 text-xs font-medium">
                            your pick
                          </span>
                        ) : null}
                        {isCorrect ? (
                          <span className="ml-auto mt-0.5 text-xs font-medium">
                            correct
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {!selected ? (
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    You did not answer this question.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
          </>
        ) : null}
      </main>
    </>
  );
}
