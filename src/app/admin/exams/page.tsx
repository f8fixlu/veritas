import Link from "next/link";
import DeleteButton from "@/components/admin/delete-button";
import DuplicateExamButton from "@/components/admin/duplicate-exam-button";
import ExamCreateForm from "@/components/admin/exam-create-form";
import ReleaseResultsButton from "@/components/admin/release-results-button";
import { examTotalPoints } from "@/lib/exam";
import { formatDateTime } from "@/lib/format";
import { getDb } from "@/lib/db";

export const metadata = { title: "Exams — Veritas Admin" };

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject: subjectParam } = await searchParams;
  const defaultSubjectId = Number(subjectParam) || undefined;

  const db = getDb();
  const [subjects, exams] = await Promise.all([
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.exam.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subject: true,
        sections: { select: { pointsPerQuestion: true } },
        questions: {
          select: { section: { select: { pointsPerQuestion: true } } },
        },
        _count: { select: { questions: true, attempts: true, sections: true } },
      },
    }),
  ]);

  const examIds = exams.map((e) => e.id);
  const subjectIds = [...new Set(exams.map((e) => e.subjectId))];

  const [submittedGroups, enrollGroups, ongoingGroups] = await Promise.all([
    examIds.length
      ? db.attempt.groupBy({
          by: ["examId"],
          _count: { _all: true },
          where: { examId: { in: examIds }, submittedAt: { not: null } },
        })
      : Promise.resolve([]),
    subjectIds.length
      ? db.enrollment.groupBy({
          by: ["subjectId"],
          _count: { _all: true },
          where: { subjectId: { in: subjectIds } },
        })
      : Promise.resolve([]),
    examIds.length
      ? db.attempt.groupBy({
          by: ["examId"],
          _count: { _all: true },
          where: { examId: { in: examIds }, submittedAt: null },
        })
      : Promise.resolve([]),
  ]);

  const submittedMap = new Map(
    submittedGroups.map((g) => [g.examId, g._count._all])
  );
  const enrollMap = new Map(enrollGroups.map((g) => [g.subjectId, g._count._all]));
  const ongoingMap = new Map(ongoingGroups.map((g) => [g.examId, g._count._all]));

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Exams
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create timed exams and import question lists
          </p>
        </div>
        <Link href="/admin/subjects" className="btn btn-secondary btn-sm">
          Go to subjects
        </Link>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {exams.length === 0 ? (
          <div className="card p-12 text-center">
            <h2 className="text-base font-semibold text-slate-900">No exams yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create your first exam using the form.
            </p>
          </div>
        ) : (
          <ul className="min-w-0 space-y-2.5">
            {exams.map((exam) => {
              const expected = enrollMap.get(exam.subjectId) ?? 0;
              const finished = submittedMap.get(exam.id) ?? 0;
              const allFinished = expected > 0 && finished >= expected;
              const ongoing = ongoingMap.get(exam.id) ?? 0;
              const totalPoints = examTotalPoints(
                exam.pointsPerQuestion,
                exam.questions
              );
              return (
                <li key={exam.id} className="card px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-slate-900">
                        {exam.title}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {exam.subject.name} ·{" "}
                        {exam._count.questions} question
                        {exam._count.questions === 1 ? "" : "s"} ·{" "}
                        {exam.durationMinutes} min ·{" "}
                        {totalPoints} pt{totalPoints === 1 ? "" : "s"} total ·{" "}
                        {exam._count.sections > 0
                          ? `${exam._count.sections} section${
                              exam._count.sections === 1 ? "" : "s"
                            }`
                          : `${exam.pointsPerQuestion} pt${
                              exam.pointsPerQuestion === 1 ? "" : "s"
                            }/question`}{" "}
                        · {exam._count.attempts} attempt
                        {exam._count.attempts === 1 ? "" : "s"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Created {formatDateTime(exam.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {ongoing > 0 ? (
                          <span className="badge bg-amber-50 text-amber-700">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600" />
                            </span>
                            {`${ongoing} in progress`}
                          </span>
                        ) : null}
                        {expected === 0 ? (
                          <span className="text-xs text-slate-400">
                            No students enrolled yet
                          </span>
                        ) : allFinished ? (
                          <>
                            <span className="badge bg-emerald-50 text-emerald-700">
                              {`All ${expected} finished`}
                            </span>
                            {exam.showResult ? (
                              <span className="badge bg-indigo-50 text-indigo-700">
                                Answers released
                              </span>
                            ) : (
                              <ReleaseResultsButton examId={exam.id} />
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                              <span
                                className="block h-full rounded-full bg-indigo-500"
                                style={{
                                  width: `${Math.round((100 * finished) / expected)}%`,
                                }}
                              />
                            </span>
                            {finished} of {expected} finished
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          exam.published
                            ? "badge bg-emerald-50 text-emerald-700"
                            : "badge bg-slate-100 text-slate-600"
                        }
                      >
                        {exam.published ? "Published" : "Draft"}
                      </span>
                      <Link
                        href={`/admin/exams/${exam.id}/report`}
                        className="btn btn-secondary btn-sm"
                      >
                        Report
                      </Link>
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Manage
                      </Link>
                      <DuplicateExamButton examId={exam.id} />
                      <DeleteButton
                        endpoint={`/api/admin/exams/${exam.id}`}
                        confirmText={`Delete "${exam.title}"? All questions and student results will be removed.`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="min-w-0">
          <ExamCreateForm subjects={subjects} defaultSubjectId={defaultSubjectId} />
        </div>
      </div>
    </>
  );
}
