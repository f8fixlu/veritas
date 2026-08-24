import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteButton from "@/components/admin/delete-button";
import EditSubjectButton from "@/components/admin/edit-subject-button";
import EnrollmentPanel from "@/components/admin/enrollment-panel";
import { getDb } from "@/lib/db";

export default async function AdminSubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const subjectId = Number((await params).id);
  if (!Number.isInteger(subjectId)) notFound();

  const db = getDb();
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    include: {
      enrollments: true,
      exams: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      },
    },
  });
  if (!subject) notFound();

  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/subjects"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← All subjects
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {subject.name}
          </h1>
          {subject.description ? (
            <p className="mt-1 text-sm text-slate-500">{subject.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <EditSubjectButton
            subjectId={subject.id}
            name={subject.name}
            description={subject.description}
          />
          <DeleteButton
            endpoint={`/api/admin/subjects/${subject.id}`}
            confirmText={`Delete "${subject.name}"? All its exams, questions and results will be removed.`}
            redirectOnSuccess="/admin/subjects"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Exams in this subject
            </h2>
            <Link href="/admin/exams" className="btn btn-primary btn-sm">
              New exam
            </Link>
          </div>
          {subject.exams.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-500">
              No exams yet. Create one from the Exams page.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {subject.exams.map((exam) => (
                <li key={exam.id} className="card px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-slate-900">
                        {exam.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {exam._count.questions} question
                        {exam._count.questions === 1 ? "" : "s"} ·{" "}
                        {exam.durationMinutes} min ·{" "}
                        {exam._count.attempts} attempt
                        {exam._count.attempts === 1 ? "" : "s"}
                      </p>
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
                        href={`/admin/exams/${exam.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <EnrollmentPanel
          subjectId={subject.id}
          subjectName={subject.name}
          students={students}
          enrolledIds={subject.enrollments.map((e) => e.userId)}
        />
      </div>
    </>
  );
}
