import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconBookOpen,
  IconCircleCheck,
  IconClipboardList,
  IconClock,
  IconHelpCircle,
  IconPercent,
} from "@/components/icons";
import { Badge, ButtonLink, Card, CardHover, CardSoft } from "@/app/ui";
import { isStaff, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";

export const metadata = { title: "Overview — Veritas" };

const RECENT_LIMIT = 5;
const RESUME_LIMIT = 5;

function StatCard({
  label,
  value,
  icon,
  href,
  valueBadge,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  valueBadge?: "info" | "success";
}) {
  return (
    <CardHover as={Link} href={href} className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className="text-indigo-500">{icon}</span>
      </div>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {valueBadge && typeof value === "number" && value > 0 ? (
          <Badge
            variant={valueBadge}
            className="px-2.5 py-0 text-base leading-7"
          >
            {value}
          </Badge>
        ) : (
          value
        )}
      </p>
    </CardHover>
  );
}

export default async function StudentOverviewPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");

  const db = getDb();
  const subjects = await db.subject.findMany({
    where: { enrollments: { some: { userId: user.id } } },
    select: {
      id: true,
      exams: {
        where: { published: true },
        select: { id: true, kind: true },
      },
    },
  });

  const rawAttempts = await db.attempt.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          kind: true,
          durationMinutes: true,
          showResult: true,
          subject: { select: { name: true } },
        },
      },
    },
  });

  // Resolve attempts whose deadline passed while the student had the tab
  // closed, so they count as completed instead of in progress. Untimed
  // assessments never expire.
  const attempts = await finalizeManyIfExpired(
    rawAttempts.map((attempt) => ({
      attempt,
      durationMinutes: attempt.exam.durationMinutes,
    }))
  );

  const attemptedExamIds = new Set(attempts.map((attempt) => attempt.examId));
  const publishedExams = subjects.flatMap((subject) => subject.exams);

  const availableExams = publishedExams.filter(
    (exam) => exam.kind !== "QUIZ" && !attemptedExamIds.has(exam.id)
  ).length;
  const availableQuizzes = publishedExams.filter(
    (exam) => exam.kind === "QUIZ" && !attemptedExamIds.has(exam.id)
  ).length;

  const inProgress = attempts.filter((attempt) => !attempt.submittedAt);
  const completed = attempts
    .filter((attempt) => attempt.submittedAt)
    .sort(
      (a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0)
    );

  const scored = completed.filter(
    (attempt) => (attempt.total ?? 0) > 0
  );
  const average = scored.length
    ? Math.round(
        scored.reduce(
          (sum, attempt) => sum + percent(attempt.score, attempt.total),
          0
        ) / scored.length
      )
    : null;

  const resumeList = inProgress.slice(0, RESUME_LIMIT);
  const recentResults = completed.slice(0, RECENT_LIMIT);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your subjects, assessments and results at a glance
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Subjects"
          value={subjects.length}
          icon={<IconBookOpen size={24} />}
          href="/subjects"
        />
        <StatCard
          label="Available exams"
          value={availableExams}
          icon={<IconClipboardList size={24} />}
          href="/exams"
          valueBadge="info"
        />
        <StatCard
          label="Available quizzes"
          value={availableQuizzes}
          icon={<IconHelpCircle size={24} />}
          href="/quiz"
          valueBadge="info"
        />
        <StatCard
          label="In progress"
          value={inProgress.length}
          icon={<IconClock size={24} />}
          href="/results"
          valueBadge="success"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          icon={<IconCircleCheck size={24} />}
          href="/results"
        />
        <StatCard
          label="Average"
          value={average === null ? "—" : `${average}%`}
          icon={<IconPercent size={24} />}
          href="/results"
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Continue where you left off
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Assessments you started but have not submitted yet
          </p>

          {resumeList.length === 0 ? (
            <Card className="mt-4 px-5 py-4 text-sm text-slate-500">
              Nothing in progress. Start an exam or quiz when you&apos;re ready.
            </Card>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {resumeList.map((attempt) => (
                <CardSoft
                  as="li"
                  key={attempt.id}
                  className="px-5 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-slate-900">
                          {attempt.exam.title}
                        </h3>
                        <Badge
                          variant={
                            attempt.exam.kind === "QUIZ" ? "info" : "slate"
                          }
                          className="shrink-0"
                        >
                          {attempt.exam.kind === "QUIZ" ? "Quiz" : "Exam"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {attempt.exam.subject.name} · Started{" "}
                        {formatDateTime(attempt.startedAt)}
                      </p>
                    </div>
                    <ButtonLink
                      href={`/attempt/${attempt.id}`}
                      variant="primary"
                      size="sm"
                      className="shrink-0 self-start sm:self-auto"
                    >
                      Resume
                    </ButtonLink>
                  </div>
                </CardSoft>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Recent results
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your latest submitted assessments
          </p>

          {recentResults.length === 0 ? (
            <Card className="mt-4 px-5 py-4 text-sm text-slate-500">
              No completed assessments yet. Your scores will show up here.
            </Card>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {recentResults.map((attempt) => {
                const pct = percent(attempt.score, attempt.total);
                return (
                  <CardSoft
                    as="li"
                    key={attempt.id}
                    className="px-5 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-slate-900">
                            {attempt.exam.title}
                          </h3>
                          <Badge
                            variant={
                              attempt.exam.kind === "QUIZ" ? "info" : "slate"
                            }
                            className="shrink-0"
                          >
                            {attempt.exam.kind === "QUIZ" ? "Quiz" : "Exam"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {attempt.exam.subject.name}
                          {attempt.submittedAt
                            ? ` · ${formatDateTime(attempt.submittedAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
                        <Badge
                          variant={
                            pct >= 75
                              ? "success"
                              : pct >= 50
                                ? "warning"
                                : "danger"
                          }
                        >
                          {`${attempt.score}/${attempt.total} \u00b7 ${pct}%`}
                        </Badge>
                        {attempt.exam.showResult ? (
                          <ButtonLink
                            href={`/result/${attempt.id}`}
                            variant="secondary"
                            size="sm"
                          >
                            Review
                          </ButtonLink>
                        ) : null}
                      </div>
                    </div>
                  </CardSoft>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
