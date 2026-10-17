import Link from "next/link";
import { notFound } from "next/navigation";
import ActionMenu from "@/components/admin/action-menu";
import DeleteButton from "@/components/admin/delete-button";
import EditQuestionButton from "@/components/admin/edit-question-button";
import ExamSettingsForm from "@/components/admin/exam-settings-form";
import ImportFromExamPanel from "@/components/admin/import-from-exam-panel";
import ImportPanel from "@/components/admin/import-panel";
import PublishToggle from "@/components/admin/publish-toggle";
import QuestionForm from "@/components/admin/question-form";
import SectionsEditor from "@/components/admin/sections-editor";
import { Badge, Card, MenuItemLink } from "@/app/ui";
import { examTotalPoints } from "@/lib/exam";
import { formatDateTime } from "@/lib/format";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { isAdmin, ownedExamWhere } from "@/lib/scope";

const LETTERS = ["A", "B", "C", "D"] as const;

export default async function AdminExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) notFound();

  const examId = Number((await params).id);
  if (!Number.isInteger(examId)) notFound();

  const db = getDb();
  const exam = await db.exam.findFirst({
    where: { id: examId, ...ownedExamWhere(user) },
    include: {
      subject: true,
      sections: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" }, include: { section: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) notFound();

  const locked = exam._count.attempts > 0;
  const totalPoints = examTotalPoints(
    exam.pointsPerQuestion,
    exam.questions.map((q) => ({
      section: q.section
        ? { pointsPerQuestion: q.section.pointsPerQuestion }
        : null,
    }))
  );

  // Source exams for "import from another exam" are scoped to this
  // instructor's own exams: questions carry the answer key.
  const otherExams = await db.exam.findMany({
    where: { id: { not: exam.id }, ...ownedExamWhere(user) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true } },
      subject: { select: { name: true } },
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/exams"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← All exams
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {exam.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {exam.subject.name} · {exam.questions.length} question
            {exam.questions.length === 1 ? "" : "s"} · {exam.durationMinutes} min
            · {totalPoints} pt{totalPoints === 1 ? "" : "s"} total ·{" "}
            {exam.sections.length > 0
              ? `${exam.sections.length} section${exam.sections.length === 1 ? "" : "s"}`
              : `${exam.pointsPerQuestion} pt${
                  exam.pointsPerQuestion === 1 ? "" : "s"
                }/question`}
            · {exam._count.attempts} attempt{exam._count.attempts === 1 ? "" : "s"}
          </p>
          {exam.scheduledDate ? (
            <p className="mt-1 text-xs text-slate-500">
              Scheduled for {formatDateTime(exam.scheduledDate)}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Badge variant={exam.published ? "success" : "slate"}>
            {exam.published ? "Published" : "Draft"}
          </Badge>
          <ActionMenu label={`Actions for ${exam.title}`}>
            <PublishToggle
              examId={exam.id}
              published={exam.published}
              menuItem
            />
            <MenuItemLink href={`/admin/exams/${exam.id}/report`}>
              Report
            </MenuItemLink>
            <DeleteButton
              endpoint={`/api/admin/exams/${exam.id}`}
              confirmText={`Delete "${exam.title}"? All questions and student results will be removed.`}
              redirectOnSuccess="/admin/exams"
              requirePassword
              menuItem
            />
          </ActionMenu>
        </div>
      </div>

      {locked ? (
        <p className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Students have already taken this exam, so questions are locked. You can
          still adjust the time limit or title.
        </p>
      ) : null}

      {!exam.published && exam.questions.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Add questions by importing a file or writing them manually, then publish
          the exam to make it visible to enrolled students.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ExamSettingsForm
          examId={exam.id}
          title={exam.title}
          description={exam.description}
          durationMinutes={exam.durationMinutes}
          pointsPerQuestion={exam.pointsPerQuestion}
          showResult={exam.showResult}
          randomize={exam.randomize}
          requireCamera={exam.requireCamera}
          requireScreenCapture={exam.requireScreenCapture}
          scheduledDate={exam.scheduledDate}
        />
        <div className="space-y-6">
          <SectionsEditor examId={exam.id} initialSections={exam.sections} />
          <ImportPanel
            examId={exam.id}
            sections={exam.sections.map((s) => ({ id: s.id, name: s.name }))}
          />
          <ImportFromExamPanel
            examId={exam.id}
            sections={exam.sections.map((s) => ({ id: s.id, name: s.name }))}
            otherExams={otherExams.map((e) => ({
              id: e.id,
              title: e.title,
              subjectName: e.subject.name,
              questions: e._count.questions,
            }))}
          />
        </div>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Questions ({exam.questions.length})
        </h2>
        {!locked && exam.questions.length > 0 ? (
          <ActionMenu label="Question actions">
            <DeleteButton
              endpoint={`/api/admin/exams/${exam.id}/questions`}
              label="Delete all"
              confirmText={`Delete all ${exam.questions.length} question${
                exam.questions.length === 1 ? "" : "s"
              } in "${exam.title}"? This cannot be undone.`}
              menuItem
            />
          </ActionMenu>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {exam.questions.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            No questions yet. Import a file or add one manually.
          </Card>
        ) : (
          <ul className="space-y-3">
            {exam.questions.map((question, index) => (
              <Card as="li" key={question.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium leading-relaxed text-slate-900">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    {question.text}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {question.section ? (
                      <Badge
                        variant="info"
                        title={`Section points: ${question.section.pointsPerQuestion}/question`}
                      >
                        {question.section.name}
                      </Badge>
                    ) : null}
                    {locked ? null : (
                      <ActionMenu label="Question actions">
                        <EditQuestionButton
                          question={{
                            id: question.id,
                            text: question.text,
                            optionA: question.optionA,
                            optionB: question.optionB,
                            optionC: question.optionC,
                            optionD: question.optionD,
                            correctOption: question.correctOption,
                            sectionId: question.sectionId,
                          }}
                          sections={exam.sections}
                          menuItem
                        />
                        <DeleteButton
                          endpoint={`/api/admin/questions/${question.id}`}
                          confirmText="Delete this question?"
                          label="Delete"
                          menuItem
                        />
                      </ActionMenu>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {LETTERS.map((letter) => {
                    const value = question[`option${letter}` as const];
                    const isCorrect = question.correctOption === letter;
                    return (
                      <div
                        key={letter}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isCorrect
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <span className="font-semibold">{letter}.</span>
                        <span>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </ul>
        )}
        {locked ? null : (
          <QuestionForm
            examId={exam.id}
            sections={exam.sections.map((s) => ({ id: s.id, name: s.name }))}
          />
        )}
      </div>
    </>
  );
}
