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

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  const rand = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
