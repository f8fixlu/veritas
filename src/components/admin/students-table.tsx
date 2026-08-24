"use client";

import { Fragment, useState } from "react";
import AttemptReviewModal from "@/components/attempt-review-modal";
import { percent } from "@/lib/format";

export type StudentAttemptRow = {
  id: number;
  title: string;
  subjectName: string;
  dateISO: string;
  submitted: boolean;
  score: number | null;
  total: number | null;
};

export type StudentTableRow = {
  id: number;
  name: string;
  email: string;
  avg: number | null;
  attempts: StudentAttemptRow[];
};

export type SubjectGroup = {
  key: string;
  title: string;
  note?: string;
  students: StudentTableRow[];
};

function scoreBadgeClass(pct: number): string {
  if (pct >= 75) return "bg-emerald-50 text-emerald-700";
  if (pct >= 50) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function GroupTable({
  group,
  openKey,
  setOpenKey,
}: {
  group: SubjectGroup;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-5 py-3">Student</th>
            <th scope="col" className="px-5 py-3">Attempts</th>
            <th scope="col" className="px-5 py-3">Avg score</th>
            <th scope="col" className="w-12 px-4 py-3">
              <span className="sr-only">Expand details</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {group.students.map((student) => {
            const key = `${group.key}:${student.id}`;
            const open = openKey === key;
            return (
              <Fragment key={key}>
                <tr className={`transition-colors ${open ? "bg-slate-50" : "hover:bg-slate-50/60"}`}>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                        {initials(student.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {student.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {student.email}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {student.attempts.length}
                  </td>
                  <td className="px-5 py-3">
                    {student.avg === null ? (
                      <span className="text-slate-400">&mdash;</span>
                    ) : (
                      <span className={`badge ${scoreBadgeClass(student.avg)}`}>
                        {`${student.avg}%`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={
                        open
                          ? `Hide details for ${student.name}`
                          : `Show details for ${student.name}`
                      }
                      aria-expanded={open}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      <Chevron open={open} />
                    </button>
                  </td>
                </tr>

                {open ? (
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-5 pb-5 pt-1">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Exam results in this subject
                        </span>
                        {student.attempts.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-400">
                            No exam attempts yet.
                          </p>
                        ) : (
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full min-w-[560px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                                  <th scope="col" className="py-2 pr-4 font-medium">Exam</th>
                                  <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                                  <th scope="col" className="py-2 pr-4 font-medium">Result</th>
                                  <th scope="col" className="py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {student.attempts.map((attempt) => {
                                  const pct = percent(attempt.score, attempt.total);
                                  return (
                                    <tr key={attempt.id}>
                                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                                        {attempt.title}
                                      </td>
                                      <td className="py-2.5 pr-4 text-slate-500">
                                        {new Date(attempt.dateISO).toLocaleDateString(
                                          "en-US",
                                          { dateStyle: "medium" }
                                        )}
                                      </td>
                                      <td className="py-2.5 pr-4">
                                        {attempt.submitted ? (
                                          <span
                                            className={`badge ${scoreBadgeClass(pct)}`}
                                          >
                                            {`${attempt.score}/${attempt.total} \u00b7 ${pct}%`}
                                          </span>
                                        ) : (
                                          <span className="badge bg-amber-50 text-amber-700">
                                            In progress
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 text-right">
                                        {attempt.submitted ? (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() =>
                                              setOpenKey(`review:${attempt.id}`)
                                            }
                                          >
                                            View answers
                                          </button>
                                        ) : null}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentsTable({ groups }: { groups: SubjectGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const reviewId = openKey?.startsWith("review:")
    ? Number(openKey.slice("review:".length))
    : null;

  return (
    <>
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.key}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {group.title}
              </h2>
              <span className="text-sm text-slate-500">
                {`${group.students.length} ${
                  group.students.length === 1 ? "student" : "students"
                }`}
              </span>
            </div>
            {group.note ? (
              <p className="mb-3 text-xs text-slate-400">{group.note}</p>
            ) : null}
            {group.students.length === 0 ? (
              <div className="card px-5 py-4 text-sm text-slate-500">
                No students enrolled yet.
              </div>
            ) : (
              <GroupTable
                group={group}
                openKey={openKey}
                setOpenKey={setOpenKey}
              />
            )}
          </section>
        ))}
      </div>

      {reviewId !== null ? (
        <AttemptReviewModal
          attemptId={reviewId}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </>
  );
}
