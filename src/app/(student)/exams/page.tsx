import { redirect } from "next/navigation";
import { isStaff, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { formatDateTime, percent } from "@/lib/format";
import { Badge, ButtonLink, Card, CardSoft } from "@/app/ui";

export const metadata = { title: "My results — Veritas" };

function scoreBadgeVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

export default async function ResultsPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");

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

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        My results
      </h1>
      <p className="mt-1 text-sm text-slate-500">Every exam you have taken</p>

      {attempts.length === 0 ? (
        <Card className="mt-6 p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No attempts yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Take an exam from your subjects page to see results here.
          </p>
        </Card>
      ) : (
          <ul className="mt-6 space-y-2.5">
            {attempts.map((attempt) => {
              const pct = percent(attempt.score, attempt.total);
              const done = Boolean(attempt.submittedAt);
              return (
                <CardSoft as="li" key={attempt.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-medium text-slate-900">
                        {attempt.exam.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {attempt.exam.subject.name}
                        {attempt.exam.subject.owner
                          ? ` · ${attempt.exam.subject.owner.name}`
                          : ""}{" "}
                        ·{" "}
                        {formatDateTime(attempt.submittedAt ?? attempt.startedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
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
                        <Badge variant="slate">
                          In progress
                        </Badge>
                      )}
                      {!done ? (
                        <ButtonLink
                          href={`/attempt/${attempt.id}`}
                          variant="primary"
                          size="sm"
                        >
                          Resume
                        </ButtonLink>
                      ) : null}
                    </div>
                  </div>
                </CardSoft>
              );
            })}
          </ul>
        )}
    </div>
  );
}
