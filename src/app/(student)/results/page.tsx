import { redirect } from "next/navigation";
import ResultTabs from "@/components/student/result-tabs";
import { isStaff, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { staffBasePath } from "@/lib/staff-path";
import { finalizeManyIfExpired } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";
import { Badge, ButtonLink, Card, CardSoft } from "@/app/ui";

export const metadata = { title: "Results" };

type ResultItem = {
  id: number;
  score: number | null;
  total: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  exam: {
    title: string;
    kind: string;
    showResult: boolean;
    subject: { name: string; owner: { name: string } | null };
  };
};

function scoreBadgeVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

function ResultRow({ attempt }: { attempt: ResultItem }) {
  const pct = percent(attempt.score, attempt.total);
  const done = Boolean(attempt.submittedAt);

  return (
    <CardSoft as="li" className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="truncate font-medium text-slate-900">
            {attempt.exam.title}
          </h4>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {formatDateTime(attempt.submittedAt ?? attempt.startedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
          {done ? (
            <>
              <Badge variant={scoreBadgeVariant(pct)}>
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
            </>
          ) : (
            <>
              <Badge variant="slate">In progress</Badge>
              <ButtonLink
                href={`/attempt/${attempt.id}`}
                variant="primary"
                size="sm"
              >
                Resume
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </CardSoft>
  );
}

function SubjectResults({
  attempts,
  emptyLabel,
}: {
  attempts: ResultItem[];
  emptyLabel: "exam" | "quiz";
}) {
  if (attempts.length === 0) {
    return (
      <Card className="px-5 py-4 text-sm text-slate-500">
        No {emptyLabel} results yet.
      </Card>
    );
  }

  // Group by subject. Subject names are only unique per instructor, so two
  // instructors can each have a "Biology" — keep their results apart.
  const groups = new Map<
    string,
    { name: string; owner: string | null; attempts: ResultItem[] }
  >();
  for (const attempt of attempts) {
    const subject = attempt.exam.subject;
    const key = `${subject.name}\u0000${subject.owner?.name ?? ""}`;
    const group = groups.get(key) ?? {
      name: subject.name,
      owner: subject.owner?.name ?? null,
      attempts: [],
    };
    group.attempts.push(attempt);
    groups.set(key, group);
  }

  const sortedGroups = [...groups.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      (a.owner ?? "").localeCompare(b.owner ?? "")
  );
  for (const group of sortedGroups) {
    group.attempts.sort(
      (a, b) =>
        (b.submittedAt?.getTime() ?? b.startedAt.getTime()) -
        (a.submittedAt?.getTime() ?? a.startedAt.getTime())
    );
  }

  return (
    <div className="space-y-8">
      {sortedGroups.map((group) => (
        <section key={`${group.name}\u0000${group.owner ?? ""}`}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight text-slate-900">
              {group.name}
              {group.owner ? (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {group.owner}
                </span>
              ) : null}
            </h3>
            <span className="shrink-0 text-sm text-slate-500">
              {group.attempts.length} result
              {group.attempts.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-2.5">
            {group.attempts.map((attempt) => (
              <ResultRow key={attempt.id} attempt={attempt} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default async function ResultsPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect(staffBasePath(user.role));

  const db = getDb();
  const rawAttempts = await db.attempt.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    include: {
      exam: {
        include: { subject: { include: { owner: { select: { name: true } } } } },
      },
    },
  });

  // Resolve attempts whose deadline passed while the student had the tab
  // closed, so they show their score here instead of claiming to still be
  // running. Durations come from the exam already included above.
  const attempts = await finalizeManyIfExpired(
    rawAttempts.map((attempt) => ({
      attempt,
      durationMinutes: attempt.exam.durationMinutes,
    }))
  );

  const exams = attempts.filter((attempt) => attempt.exam.kind !== "QUIZ");
  const quizzes = attempts.filter((attempt) => attempt.exam.kind === "QUIZ");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        My results
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Every exam and quiz you have taken, grouped by subject
      </p>

      {attempts.length === 0 ? (
        <Card className="mt-6 p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No attempts yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Take an exam or quiz from your Exams or Quizzes page to see results
            here.
          </p>
        </Card>
      ) : (
        <div className="mt-6">
          <ResultTabs
            tabs={[
              {
                id: "exams",
                label: "Exams",
                count: exams.length,
                content: <SubjectResults attempts={exams} emptyLabel="exam" />,
              },
              {
                id: "quizzes",
                label: "Quizzes",
                count: quizzes.length,
                content: (
                  <SubjectResults attempts={quizzes} emptyLabel="quiz" />
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
