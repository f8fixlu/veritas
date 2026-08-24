import Link from "next/link";
import { getDb } from "@/lib/db";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-6 py-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export const metadata = { title: "Admin — Veritas" };

export default async function AdminOverviewPage() {
  const db = getDb();
  const [students, notEnrolled, subjects, exams, attempts] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({
      where: { role: "STUDENT", enrollments: { none: {} } },
    }),
    db.subject.count(),
    db.exam.count(),
    db.attempt.count(),
  ]);

  const publishedExams = await db.exam.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    include: {
      subject: true,
      attempts: { select: { userId: true, startedAt: true, submittedAt: true } },
    },
  });

  const subjectIds = [...new Set(publishedExams.map((e) => e.subjectId))];
  const enrollments =
    subjectIds.length > 0
      ? await db.enrollment.findMany({
          where: { subjectId: { in: subjectIds } },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        })
      : [];

  const enrollmentsBySubject = new Map<number, typeof enrollments>();
  for (const enrollment of enrollments) {
    const list = enrollmentsBySubject.get(enrollment.subjectId) ?? [];
    list.push(enrollment);
    enrollmentsBySubject.set(enrollment.subjectId, list);
  }

  type PendingGroup = {
    examId: number;
    examTitle: string;
    subjectName: string;
    finished: number;
    expected: number;
    pending: { id: number; name: string; started: boolean }[];
  };

  const pendingGroups: PendingGroup[] = [];
  for (const exam of publishedExams) {
    const enrolled = enrollmentsBySubject.get(exam.subjectId) ?? [];
    const submittedIds = new Set(
      exam.attempts.filter((a) => a.submittedAt).map((a) => a.userId)
    );
    const startedIds = new Set(exam.attempts.map((a) => a.userId));
    const pending = enrolled
      .filter((e) => !submittedIds.has(e.user.id))
      .map((e) => ({
        id: e.user.id,
        name: e.user.name,
        started: startedIds.has(e.user.id),
      }));
    if (pending.length > 0) {
      pendingGroups.push({
        examId: exam.id,
        examTitle: exam.title,
        subjectName: exam.subject.name,
        finished: enrolled.length - pending.length,
        expected: enrolled.length,
        pending,
      });
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Overview
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage subjects, exams and monitor activity
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Students" value={students} />
        <StatCard label="Not enrolled" value={notEnrolled} />
        <StatCard label="Subjects" value={subjects} />
        <StatCard label="Exams" value={exams} />
        <StatCard label="Exam attempts" value={attempts} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/subjects" className="card p-6 transition-shadow hover:shadow-md">
          <h2 className="font-medium text-slate-900">Manage subjects</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create subjects and enroll students into them.
          </p>
        </Link>
        <Link href="/admin/exams" className="card p-6 transition-shadow hover:shadow-md">
          <h2 className="font-medium text-slate-900">Manage exams</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create timed exams and import question lists.
          </p>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Haven&apos;t taken the exam yet
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enrolled students without a submitted attempt for each published exam
        </p>

        {pendingGroups.length === 0 ? (
          <p className="mt-4 inline-block rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            All caught up — every enrolled student has finished their published
            exams.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {pendingGroups.map((group) => (
              <li key={group.examId} className="card px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">
                      {group.examTitle}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {group.subjectName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/exams/${group.examId}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Manage
                    </Link>
                    <span className="badge bg-amber-50 text-amber-700">
                      {`${group.pending.length} pending`}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.pending.map((student) => (
                    <span
                      key={student.id}
                      className={
                        student.started
                          ? "badge bg-amber-50 text-amber-700"
                          : "badge bg-slate-100 text-slate-600"
                      }
                      title={
                        student.started
                          ? "Started but not submitted"
                          : "Not started"
                      }
                    >
                      {student.started
                        ? `${student.name} \u00b7 in progress`
                        : student.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
