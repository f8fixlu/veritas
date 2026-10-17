import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finalizeManyIfExpired } from "@/lib/exam";
import { ownedExamWhere } from "@/lib/scope";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  const db = getDb();
  const exam = await db.exam.findFirst({
    where: { id, ...ownedExamWhere(user) },
    include: {
      subject: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const enrollments = await db.enrollment.findMany({
    where: { subjectId: exam.subjectId },
    include: {
      user: { select: { id: true, name: true, email: true, gender: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const attempts = await db.attempt.findMany({ where: { examId: id } });
  const resolvedAttempts = await finalizeManyIfExpired(
    attempts.map((a) => ({ attempt: a, durationMinutes: exam.durationMinutes }))
  );
  const resolvedByUser = new Map(resolvedAttempts.map((a) => [a.userId, a]));

  if (type === "leaderboard") {
    const completed = enrollments
      .map((e) => {
        const r = resolvedByUser.get(e.userId);
        if (!r?.submittedAt) return null;
        return {
          userId: e.userId,
          name: e.user.name,
          email: e.user.email,
          score: r.score ?? 0,
          total: r.total ?? 0,
          pct: r.total ? Math.round(((r.score ?? 0) / r.total) * 100) : 0,
          submittedAt: r.submittedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.pct - a.pct || a.submittedAt.getTime() - b.submittedAt.getTime());

    const header = ["Rank", "Student", "Email", "Score", "Total", "Percent", "Submitted"];
    const lines = [header.join(",")];
    completed.forEach((row, i) => {
      lines.push(
        [
          i + 1,
          csvEscape(row.name),
          csvEscape(row.email),
          row.score,
          row.total,
          row.pct + "%",
          csvEscape(row.submittedAt.toISOString()),
        ].join(",")
      );
    });

    const csv = lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leaderboard-${exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`,
      },
    });
  }

  // Default: students export
  const header = ["Student", "Email", "Gender", "Status", "Score", "Total", "Percent", "Submitted"];
  const lines = [header.join(",")];
  for (const e of enrollments) {
    const r = resolvedByUser.get(e.userId);
    const submitted = Boolean(r?.submittedAt);
    lines.push(
      [
        csvEscape(e.user.name),
        csvEscape(e.user.email),
        csvEscape(e.user.gender ?? ""),
        submitted ? "Completed" : "Not submitted",
        submitted ? (r?.score ?? 0) : "",
        submitted ? (r?.total ?? "") : "",
        submitted && r?.total ? Math.round(((r.score ?? 0) / r.total) * 100) + "%" : "",
        submitted && r?.submittedAt ? csvEscape(r.submittedAt.toISOString()) : "",
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`,
    },
  });
}
