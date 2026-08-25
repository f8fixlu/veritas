import { redirect } from "next/navigation";
import NavBar from "@/components/nav-bar";
import PaginatedExamList, {
  type DashboardExam,
  type DashboardExamStatus,
} from "@/components/dashboard/paginated-exam-list";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { examTotalPoints, finalizeIfExpired } from "@/lib/exam";

export const metadata = { title: "Dashboard — Veritas" };

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
          questions: {
            select: { section: { select: { pointsPerQuestion: true } } },
          },
        },
      },
    },
  });

  const myAttempts = await db.attempt.findMany({ where: { userId: user.id } });
  const attemptsByExam = new Map(myAttempts.map((a) => [a.examId, a]));

  async function statusFor(exam: {
    id: number;
    durationMinutes: number;
  }): Promise<DashboardExamStatus> {
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

  const statusesByExam = new Map<number, DashboardExamStatus>();
  await Promise.all(
    subjects.flatMap((s) =>
      s.exams.map(async (exam) => {
        statusesByExam.set(exam.id, await statusFor(exam));
      })
    )
  );

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
              You have not been enrolled in any subjects. Ask your instructor
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
                  <PaginatedExamList
                    exams={subject.exams.map((exam) => examViews.get(exam.id)!)}
                    statuses={Object.fromEntries(statusesByExam)}
                  />
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
