import Link from "next/link";
import { notFound } from "next/navigation";
import ActionMenu from "@/components/admin/action-menu";
import DeleteButton from "@/components/admin/delete-button";
import EditSubjectButton from "@/components/admin/edit-subject-button";
import EnrollmentPanel from "@/components/admin/enrollment-panel";
import SubjectTokenCard from "@/components/admin/subject-token-card";
import { Badge, ButtonLink, Card } from "@/app/ui";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdmin, ownedStudentIds, ownedSubjectWhere } from "@/lib/scope";

export default async function AdminSubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) notFound();

  const subjectId = Number((await params).id);
  if (!Number.isInteger(subjectId)) notFound();

  const db = getDb();
  const subject = await db.subject.findFirst({
    where: { id: subjectId, ...ownedSubjectWhere(user) },
    include: {
      enrollments: true,
      exams: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      },
    },
  });
  if (!subject) notFound();

  // Only students this instructor already teaches somewhere are listed here.
  // Anyone else has to be looked up by name/email in the enrollment panel, so
  // one instructor can never page through another instructor's roster.
  const mine = await ownedStudentIds(user);
  const students = mine.length
    ? await db.user.findMany({
        where: { id: { in: mine } },
        select: { id: true, name: true, firstName: true, lastName: true, avatarData: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

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
        <ActionMenu label={`Actions for ${subject.name}`}>
          <EditSubjectButton
            subjectId={subject.id}
            name={subject.name}
            description={subject.description}
            menuItem
          />
          <DeleteButton
            endpoint={`/api/admin/subjects/${subject.id}`}
            confirmText={`Delete "${subject.name}"? All its exams, questions and results will be removed.`}
            redirectOnSuccess="/admin/subjects"
            requirePassword
            menuItem
          />
        </ActionMenu>
      </div>

      <div className="mt-6 space-y-6">
        <SubjectTokenCard
          subjectId={subject.id}
          subjectName={subject.name}
          token={subject.joinToken ?? ""}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Exams in this subject
            </h2>
            <ButtonLink
              href={`/admin/exams?subject=${subject.id}`}
              variant="primary"
              size="sm"
            >
              New exam
            </ButtonLink>
          </div>
          {subject.exams.length === 0 ? (
            <Card className="p-10 text-center text-sm text-slate-500">
              No exams yet. Create one from the Exams page.
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {subject.exams.map((exam) => (
                <Card as="li" key={exam.id} className="px-5 py-4">
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
                      <Badge variant={exam.published ? "success" : "slate"}>
                        {exam.published ? "Published" : "Draft"}
                      </Badge>
                      <ButtonLink
                        href={`/admin/exams/${exam.id}`}
                        variant="secondary"
                        size="sm"
                      >
                        Manage
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <EnrollmentPanel
            subjectId={subject.id}
            subjectName={subject.name}
            students={students}
            enrolledIds={subject.enrollments.map((e) => e.userId)}
          />
        </div>
      </div>
      </div>
    </>
  );
}
