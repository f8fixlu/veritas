import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import StartExamButton from "@/components/student/start-exam-button";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeIfExpired } from "@/lib/exam";

export const metadata = { title: "Exam — Veritas" };

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const examId = Number((await params).id);
  if (!Number.isInteger(examId)) notFound();

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      subject: true,
      _count: { select: { questions: true } },
    },
  });
  if (!exam || !exam.published) notFound();

  const enrolled = await db.enrollment.findUnique({
    where: {
      userId_subjectId: { userId: user.id, subjectId: exam.subjectId },
    },
  });

  if (!enrolled && user.role !== "ADMIN") {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="card p-8 text-center">
            <h1 className="text-lg font-semibold text-slate-900">
              Not enrolled
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              You are not enrolled in {exam.subject.name}, so this exam is not
              available to you.
            </p>
            <Link href="/subjects" className="btn btn-secondary btn-sm mt-4">
              Back to subjects
            </Link>
          </div>
        </main>
      </>
    );
  }

  const attempt = await db.attempt.findUnique({
    where: { examId_userId: { examId, userId: user.id } },
  });

  if (attempt) {
    const finalized = await finalizeIfExpired(attempt, exam.durationMinutes);
    if (finalized.submittedAt) redirect(`/result/${finalized.id}`);
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="card p-8">
          <p className="badge bg-indigo-50 text-indigo-700">{exam.subject.name}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {exam.title}
          </h1>
          {exam.description ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {exam.description}
            </p>
          ) : null}

          <dl className="my-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 px-3 py-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Questions
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {exam._count.questions}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Time limit
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">
                {exam.durationMinutes} min
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Attempts
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">1</dd>
            </div>
          </dl>

          {attempt ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You have an unfinished attempt. The clock is still running from
                when you started.
              </p>
              <StartExamButton examId={exam.id} label="Resume exam" />
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="list-inside list-disc space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <li>The timer starts as soon as you press start.</li>
                <li>Your answers are submitted automatically when time runs out.</li>
                <li>You can submit early once every question is answered.</li>
                <li>Your score will be shown right after you submit.</li>
                <li>
                  {exam.showResult
                    ? "The full answer review opens right after submitting."
                    : "The full answer review is released later by your instructor."}
                </li>
                <li>You get one attempt only.</li>
              </ul>
              <StartExamButton examId={exam.id} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
