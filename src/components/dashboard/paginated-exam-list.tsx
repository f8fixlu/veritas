"use client";

import Link from "next/link";
import { useState } from "react";

export type DashboardExam = {
  id: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  totalPoints: number;
  scheduledDate: string | null;
  sections: {
    id: number;
    name: string;
    details: string | null;
    pointsPerQuestion: number;
  }[];
};

export type DashboardExamStatus =
  | { kind: "open" }
  | { kind: "active"; attemptId: number }
  | { kind: "done"; attemptId: number; score: number; total: number };

const PAGE_SIZE = 3;

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function PaginatedExamList({
  exams,
  statuses,
}: {
  exams: DashboardExam[];
  statuses: Record<number, DashboardExamStatus>;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(exams.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = exams.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <ul className="space-y-2.5">
        {visible.map((exam) => {
          const status = statuses[exam.id] ?? { kind: "open" as const };
          return (
            <li
              key={exam.id}
              className="card flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <h3 className="truncate font-medium text-slate-900">
                  {exam.title}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {exam.questionCount} question
                  {exam.questionCount === 1 ? "" : "s"} ·{" "}
                  {exam.durationMinutes} min · {exam.totalPoints} pt
                  {exam.totalPoints === 1 ? "" : "s"} total
                </p>
                {exam.scheduledDate ? (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Scheduled · {formatScheduledDate(exam.scheduledDate)}
                  </p>
                ) : null}
                {exam.sections.length > 0 ? (
                  <div className="mt-2 space-y-1 border-l-2 border-indigo-100 pl-3">
                    {exam.sections.map((section) => (
                      <div key={section.id}>
                        <p className="text-xs font-medium text-slate-700">
                          {section.name} ·{" "}
                          <span className="font-normal">
                            {section.pointsPerQuestion} pt
                            {section.pointsPerQuestion === 1 ? "" : "s"}
                            /question
                          </span>
                        </p>
                        {section.details ? (
                          <p className="text-xs text-slate-500">
                            {section.details}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {status.kind === "done" ? (
                  <>
                    <span className="badge bg-emerald-50 text-emerald-700">
                      {`${status.score}/${status.total} \u00b7 ${Math.round(
                        (100 * status.score) / Math.max(1, status.total)
                      )}%`}
                    </span>
                    <Link
                      href={`/result/${status.attemptId}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View result
                    </Link>
                  </>
                ) : status.kind === "active" ? (
                  <>
                    <span className="badge bg-amber-50 text-amber-700">
                      In progress
                    </span>
                    <Link
                      href={`/attempt/${status.attemptId}`}
                      className="btn btn-primary btn-sm"
                    >
                      Resume
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="badge bg-slate-100 text-slate-600">
                      Open
                    </span>
                    <Link
                      href={`/exam/${exam.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Take exam
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            &larr; Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next &rarr;
          </button>
        </div>
      ) : null}
    </>
  );
}
