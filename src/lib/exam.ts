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

export function examTotalPoints(
  defaultPointsPerQuestion: number,
  questions: { section: { pointsPerQuestion: number } | null }[]
): number {
  return questions.reduce(
    (sum, q) => sum + (q.section?.pointsPerQuestion ?? defaultPointsPerQuestion),
    0
  );
}

export async function finalizeIfExpired(
  attempt: AttemptLike & { examId: number },
  durationMinutes: number
): Promise<AttemptLike> {
  if (attempt.submittedAt) return attempt;
  const endsAt = attemptEndsAt(attempt, durationMinutes);
  if (Date.now() < endsAt.getTime()) return attempt;

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: attempt.examId },
    select: { pointsPerQuestion: true },
  });
  const defaultPpq = exam?.pointsPerQuestion ?? 1;
  const questions = await db.question.findMany({
    where: { examId: attempt.examId },
    select: { section: { select: { pointsPerQuestion: true } } },
  });
  const total = examTotalPoints(defaultPpq, questions);
  const answers = await db.answer.findMany({
    where: { attemptId: attempt.id },
  });
  const correctIds = new Set(
    answers.filter((a) => a.isCorrect).map((a) => a.questionId)
  );
  // Recompute from stored correctness so points stay accurate per section.
  const answeredQuestions = await db.question.findMany({
    where: { id: { in: [...correctIds] } },
    select: { section: { select: { pointsPerQuestion: true } } },
  });
  const score = answeredQuestions.reduce(
    (sum, q) => sum + (q.section?.pointsPerQuestion ?? defaultPpq),
    0
  );
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
