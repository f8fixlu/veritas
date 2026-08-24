import { getDb } from "./db";

export type AttemptLike = {
  id: number;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  total: number | null;
};

export function attemptEndsAt(attempt: AttemptLike, durationMinutes: number) {
  return new Date(attempt.startedAt.getTime() + durationMinutes * 60_000);
}

export async function finalizeIfExpired(
  attempt: AttemptLike & { examId: number },
  durationMinutes: number
): Promise<AttemptLike> {
  if (attempt.submittedAt) return attempt;
  const endsAt = attemptEndsAt(attempt, durationMinutes);
  if (Date.now() < endsAt.getTime()) return attempt;

  const db = getDb();
  const answers = await db.answer.findMany({
    where: { attemptId: attempt.id },
  });
  const score = answers.filter((a) => a.isCorrect).length;
  const total = await db.question.count({ where: { examId: attempt.examId } });
  const updated = await db.attempt.update({
    where: { id: attempt.id },
    data: { submittedAt: endsAt, score, total },
  });
  return updated;
}
