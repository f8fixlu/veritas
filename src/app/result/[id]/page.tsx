import { notFound, redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import PrintButton from "@/components/print-button";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeIfExpired, type AttemptLike } from "@/lib/exam";
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
            include: {
              section: {
                select: { name: true, details: true, pointsPerQuestion: true },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt || (attempt.userId !== user.id && user.role !== "ADMIN")) notFound();

  // If the attempt is not yet submitted, make sure it has expired before we
  // finalize it; otherwise send the student back to the running exam.
  let finalized: AttemptLike = attempt;
  if (!attempt.submittedAt) {
    if (
      nowMs() <
      attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60_000
    ) {
      redirect(`/attempt/${attempt.id}`);
    }
    finalized = await finalizeIfExpired(
      attempt,
      attempt.exam.durationMinutes
    );
  }

  const score = finalized.score ?? 0;
  const total = finalized.total ?? attempt.exam.questions.length;
  const submittedAt = finalized.submittedAt;

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
          <p className="print-only mt-1 text-sm text-slate-600">
            Student: {user.name} ({user.email})
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
          <div className="mt-4 flex justify-center">
            <PrintButton label="Print result" />
          </div>
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
            const prev = index > 0 ? attempt.exam.questions[index - 1] : null;
            const section = question.section;
            const sectionChanged =
              section != null &&
              (prev == null || prev.sectionId !== question.sectionId);
            return (
              <li key={question.id} className="space-y-2">
                {section != null && sectionChanged ? (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-3 print:border-slate-300 print:bg-transparent">
                    <p className="text-sm font-semibold text-indigo-900 print:text-black">
                      {section.name}
                      <span className="ml-2 font-normal text-indigo-700 print:text-slate-700">
                        · {section.pointsPerQuestion} pt
                        {section.pointsPerQuestion === 1 ? "" : "s"} per
                        question
                      </span>
                    </p>
                    {section.details ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-indigo-700 print:text-slate-700">
                        {section.details}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="card p-5">
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
                </div>
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
