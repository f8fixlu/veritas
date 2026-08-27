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

type GradableQuestion = {
  id: number;
  section: { pointsPerQuestion: number } | null;
};

function computeTotalPoints(
  defaultPointsPerQuestion: number,
  questions: GradableQuestion[]
): number {
  return questions.reduce(
    (sum, q) => sum + (q.section?.pointsPerQuestion ?? defaultPointsPerQuestion),
    0
  );
}

function computeScore(
  defaultPointsPerQuestion: number,
  questions: GradableQuestion[],
  answers: { questionId: number; isCorrect: boolean }[]
): number {
  const correctIds = new Set(
    answers.filter((a) => a.isCorrect).map((a) => a.questionId)
  );
  return questions.reduce(
    (sum, q) =>
      sum +
      (correctIds.has(q.id)
        ? (q.section?.pointsPerQuestion ?? defaultPointsPerQuestion)
        : 0),
    0
  );
}

export async function finalizeIfExpired(
  attempt: AttemptLike & { examId: number },
  durationMinutes: number
): Promise<AttemptLike> {
  return (await finalizeManyIfExpired([{ attempt, durationMinutes }]))[0];
}

/**
 * Finalizes any attempts that are still running (unsubmitted and past their
 * deadline) in a small number of batched queries. Returns the updated
 * attempts in the same order as the input, preserving any extra fields (such
 * as `userId` or included relations) found on the input attempts. Attempts
 * that did not expire (or were already submitted) are returned unchanged.
 */
export async function finalizeManyIfExpired<
  T extends AttemptLike & { examId: number }
>(
  entries: { attempt: T; durationMinutes: number }[]
): Promise<T[]> {
  const results: T[] = entries.map((e) => e.attempt);

  const pending = entries
    .map((entry, index) => ({ ...entry, index }))
    .filter(({ attempt, durationMinutes }) => {
      if (attempt.submittedAt) return false;
      return Date.now() >= attemptEndsAt(attempt, durationMinutes).getTime();
    });

  if (pending.length === 0) return results;

  const db = getDb();
  const examIds = [...new Set(pending.map((p) => p.attempt.examId))];

  const [exams, questions, answers] = await Promise.all([
    db.exam.findMany({
      where: { id: { in: examIds } },
      select: { id: true, pointsPerQuestion: true },
    }),
    db.question.findMany({
      where: { examId: { in: examIds } },
      select: {
        id: true,
        examId: true,
        section: { select: { pointsPerQuestion: true } },
      },
    }),
    db.answer.findMany({
      where: { attemptId: { in: pending.map((p) => p.attempt.id) } },
      select: { attemptId: true, questionId: true, isCorrect: true },
    }),
  ]);

  const ppqByExam = new Map(exams.map((e) => [e.id, e.pointsPerQuestion]));
  const questionsByExam = new Map<number, GradableQuestion[]>();
  for (const q of questions) {
    const list = questionsByExam.get(q.examId) ?? [];
    list.push(q);
    questionsByExam.set(q.examId, list);
  }
  const answersByAttempt = new Map<number, typeof answers>();
  for (const a of answers) {
    const list = answersByAttempt.get(a.attemptId) ?? [];
    list.push(a);
    answersByAttempt.set(a.attemptId, list);
  }

  await db.$transaction(
    pending.map((p) => {
      const endsAt = attemptEndsAt(p.attempt, p.durationMinutes);
      const qs = questionsByExam.get(p.attempt.examId) ?? [];
      const defaultPpq = ppqByExam.get(p.attempt.examId) ?? 1;
      const total = computeTotalPoints(defaultPpq, qs);
      const score = computeScore(
        defaultPpq,
        qs,
        answersByAttempt.get(p.attempt.id) ?? []
      );
      results[p.index] = {
        ...p.attempt,
        submittedAt: endsAt,
        score,
        total,
      };
      return db.attempt.update({
        where: { id: p.attempt.id },
        data: { submittedAt: endsAt, score, total },
      });
    })
  );

  return results;
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
