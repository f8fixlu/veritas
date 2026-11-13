import { redirect } from "next/navigation";
import JoinTokenForm from "@/components/student/join-token-form";
import LinkInstructorForm from "@/components/student/link-instructor-form";
import { isStaff, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Badge, ButtonLink, Card, CardSoft } from "@/app/ui";

export const metadata = { title: "Subjects — Veritas" };

export default async function SubjectsPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");

  const db = getDb();
  const subjects = await db.subject.findMany({
    where: { enrollments: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    include: {
      // Subject names are only unique per instructor, so two instructors can
      // each have a "Biology" — show who teaches it.
      owner: { select: { id: true, name: true } },
      exams: {
        where: { published: true },
        select: { kind: true },
      },
    },
  });

  const instructorLinks = await db.instructorStudent.findMany({
    where: { studentId: user.id },
    orderBy: { instructor: { name: "asc" } },
    select: { instructor: { select: { id: true, name: true } } },
  });
  const subjectGroups = new Map<
    number | null,
    { instructorName: string; subjects: typeof subjects }
  >();
  for (const subject of subjects) {
    const instructorId = subject.owner?.id ?? null;
    const group = subjectGroups.get(instructorId) ?? {
      instructorName: subject.owner?.name ?? "Instructor not assigned",
      subjects: [],
    };
    group.subjects.push(subject);
    subjectGroups.set(instructorId, group);
  }
  const sortedGroups = [...subjectGroups.entries()].sort(
    ([, a], [, b]) => a.instructorName.localeCompare(b.instructorName)
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Subjects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every subject you are enrolled in
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href="/exams" variant="secondary" size="sm">
            Exams
          </ButtonLink>
          <ButtonLink href="/quiz" variant="secondary" size="sm">
            Quizzes
          </ButtonLink>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <LinkInstructorForm
          instructors={instructorLinks.map((link) => link.instructor)}
        />
        <JoinTokenForm />
      </div>

      {subjects.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-600">
            V
          </span>
          <h2 className="text-base font-semibold text-slate-900">
            No subjects yet
          </h2>
          <p className="max-w-sm text-sm text-slate-500">
            Ask your instructor for the 6-character enrollment token for their
            subject, then use the box above to join.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([instructorId, group]) => (
            <section key={instructorId ?? "unassigned"}>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {group.instructorName}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {group.subjects.map((subject) => {
                  const examCount = subject.exams.filter(
                    (exam) => exam.kind !== "QUIZ"
                  ).length;
                  const quizCount = subject.exams.filter(
                    (exam) => exam.kind === "QUIZ"
                  ).length;

                  return (
                    <CardSoft
                      as="li"
                      key={subject.id}
                      className="flex items-start justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-slate-900">
                          {subject.name}
                        </h3>
                        {subject.description ? (
                          <p className="mt-0.5 truncate text-sm text-slate-500">
                            {subject.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="slate">
                          {examCount} exam{examCount === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="info">
                          {quizCount} quiz{quizCount === 1 ? "" : "zes"}
                        </Badge>
                      </div>
                    </CardSoft>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
