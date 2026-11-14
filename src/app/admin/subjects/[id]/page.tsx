import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata = { title: "Subject" };
import ActionMenu from "@/components/admin/action-menu";
import DeleteButton from "@/components/admin/delete-button";
import EditSubjectButton from "@/components/admin/edit-subject-button";
import EnrollmentPanel from "@/components/admin/enrollment-panel";
import SubjectTokenCard from "@/components/admin/subject-token-card";
import ResultTabs from "@/components/student/result-tabs";
import { Badge, ButtonLink, Card } from "@/app/ui";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdmin, ownedStudentIds, ownedSubjectWhere } from "@/lib/scope";
import { staffPath } from "@/lib/staff-path";

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
      schoolOption: { select: { name: true } },
      exams: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      },
    },
  });
  if (!subject) notFound();
  const subjectPath = staffPath(user.role, "/admin/subjects");
  const examPath = staffPath(user.role, "/admin/exams");
  const quizPath = staffPath(user.role, "/admin/quiz");

  const exams = subject.exams.filter((assessment) => assessment.kind !== "QUIZ");
  const quizzes = subject.exams.filter((assessment) => assessment.kind === "QUIZ");
  const renderAssessments = (
    assessments: typeof subject.exams,
    label: "exam" | "quiz"
  ) =>
    assessments.length === 0 ? (
      <Card className="p-10 text-center text-sm text-slate-500">
        No {label}s in this subject yet.
      </Card>
    ) : (
      <ul className="space-y-2.5">
        {assessments.map((assessment) => (
          <Card as="li" key={assessment.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-slate-900">
                  {assessment.title}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {assessment._count.questions} question
                  {assessment._count.questions === 1 ? "" : "s"} ·{" "}
                  {assessment.durationMinutes === null
                    ? "No time limit"
                    : `${assessment.durationMinutes} min`} ·{" "}
                  {assessment._count.attempts} attempt
                  {assessment._count.attempts === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={assessment.published ? "success" : "slate"}>
                  {assessment.published ? "Published" : "Draft"}
                </Badge>
                <ButtonLink
                  href={`${assessment.kind === "QUIZ" ? quizPath : examPath}/${assessment.id}`}
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
    );

  // Only students linked to this instructor are listed here. The enroll panel
  // never exposes students linked only to another instructor.
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
            href={subjectPath}
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
            confirmText={`Delete "${subject.name}"? All its assessments, questions and results will be removed.`}
            redirectOnSuccess={subjectPath}
            requirePassword
            menuItem
          />
        </ActionMenu>
      </div>

      <div className="mt-6 space-y-6">
        <SubjectTokenCard
          subjectId={subject.id}
          subjectName={subject.name}
          schoolName={subject.schoolOption?.name ?? null}
          token={subject.joinToken ?? ""}
        />

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Assessments in this subject
            </h2>
            <div className="flex items-center gap-2">
              <ButtonLink
                href={`${examPath}?subject=${subject.id}`}
                variant="primary"
                size="sm"
              >
                New exam
              </ButtonLink>
              <ButtonLink
                href={`${quizPath}?subject=${subject.id}`}
                variant="secondary"
                size="sm"
              >
                New quiz
              </ButtonLink>
            </div>
          </div>
          <ResultTabs
            tabs={[
              {
                id: "subject-" + subject.id + "-exams",
                label: "Exams",
                count: exams.length,
                content: renderAssessments(exams, "exam"),
              },
              {
                id: "subject-" + subject.id + "-quizzes",
                label: "Quizzes",
                count: quizzes.length,
                content: renderAssessments(quizzes, "quiz"),
              },
            ]}
          />
        </section>

        <div className="h-full space-y-6">
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
