import PaginatedExamList, {
  type DashboardExam,
  type DashboardExamStatus,
} from "@/components/dashboard/paginated-exam-list";
import { Card } from "@/app/ui";
import { getDb } from "@/lib/db";
import {
  examTotalPoints,
  finalizeManyIfExpired,
  type AssessmentKind,
} from "@/lib/exam";

/**
 * Published exams (or quizzes) for every subject the student is enrolled in.
 * Shared by the exam list (`/exams`) and the quiz list (`/quiz`) so
 * both stay identical apart from the kind they display.
 */
export default async function StudentAssessmentSections({
  userId,
  kind,
}: {
  userId: number;
  kind: AssessmentKind;
}) {
  const noun = kind === "QUIZ" ? "quiz" : "exam";
  const db = getDb();

  const subjects = await db.subject.findMany({
    where: { enrollments: { some: { userId } } },
    orderBy: { name: "asc" },
    include: {
      // Subject names are only unique per instructor, so two instructors can
      // each have a "Biology" — show who teaches it.
      owner: { select: { name: true } },
      exams: {
        where: { published: true, kind },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true } },
          sections: { orderBy: { order: "asc" } },
          questions: {
            select: { section: { select: { pointsPerQuestion: true } } },
          },
        },
      },
    },
  });

  if (subjects.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
          V
        </span>
        <h2 className="text-base font-semibold text-slate-900">
          No subjects yet
        </h2>
        <p className="max-w-sm text-sm text-slate-500">
          Ask your instructor for the 6-character enrollment token for their
          subject, then use the box on your Subjects page to join.
        </p>
      </Card>
    );
  }

  const myAttempts = await db.attempt.findMany({ where: { userId } });

  // Resolve any expired attempts in one batched pass, keying each attempt's
  // duration by its exam (loaded above). Untimed assessments never expire.
  const durationByExam = new Map<number, number | null>();
  for (const s of subjects) {
    for (const exam of s.exams) {
      durationByExam.set(exam.id, exam.durationMinutes);
    }
  }
  const resolvedAttempts = await finalizeManyIfExpired(
    myAttempts
      .map((attempt) => {
        const durationMinutes = durationByExam.get(attempt.examId);
        if (durationMinutes === undefined) return null;
        return { attempt, durationMinutes };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
  );

  const attemptsByExam = new Map(
    resolvedAttempts.map((attempt) => [attempt.examId, attempt])
  );

  const statusesByExam = new Map<number, DashboardExamStatus>();
  for (const s of subjects) {
    for (const exam of s.exams) {
      const attempt = attemptsByExam.get(exam.id);
      if (!attempt) {
        statusesByExam.set(exam.id, { kind: "open" });
      } else if (attempt.submittedAt) {
        statusesByExam.set(exam.id, {
          kind: "done",
          attemptId: attempt.id,
          score: attempt.score ?? 0,
          total: attempt.total ?? 0,
        });
      } else {
        statusesByExam.set(exam.id, {
          kind: "active",
          attemptId: attempt.id,
        });
      }
    }
  }

  const examViews = new Map<number, DashboardExam>(
    subjects.flatMap((s) =>
      s.exams.map((exam) => [
        exam.id,
        {
          id: exam.id,
          title: exam.title,
          durationMinutes: exam.durationMinutes,
          questionCount: exam._count.questions,
          totalPoints: examTotalPoints(exam.pointsPerQuestion, exam.questions),
          scheduledDate: exam.scheduledDate?.toISOString() ?? null,
          sections: exam.sections.map((sec) => ({
            id: sec.id,
            name: sec.name,
            details: sec.details,
            pointsPerQuestion: sec.pointsPerQuestion,
          })),
        },
      ])
    )
  );

  return (
    <div className="space-y-8">
      {subjects.map((subject) => (
        <section key={subject.id}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {subject.name}
              {subject.owner ? (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {subject.owner.name}
                </span>
              ) : null}
            </h2>
            {subject.description ? (
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                {subject.description}
              </p>
            ) : null}
          </div>
          {subject.exams.length === 0 ? (
            <Card className="px-5 py-4 text-sm text-slate-500">
              No {noun}s have been published for this subject yet.
            </Card>
          ) : (
            <PaginatedExamList
              kind={kind}
              exams={subject.exams.map((exam) => examViews.get(exam.id)!)}
              statuses={Object.fromEntries(statusesByExam)}
            />
          )}
        </section>
      ))}
    </div>
  );
}
