"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import AttemptReviewModal from "@/components/attempt-review-modal";
import ConfirmModal from "@/components/confirm-modal";
import DeleteButton from "@/components/admin/delete-button";
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
  gender: string | null;
  subjects: string[];
  avg: number | null;
  attempts: StudentAttemptRow[];
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

export default function StudentsTable({
  students,
  canDeleteStudents,
  emptyLabel,
}: {
  students: StudentTableRow[];
  canDeleteStudents: boolean;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [retakeId, setRetakeId] = useState<number | null>(null);
  const [retakeBusy, setRetakeBusy] = useState(false);
  const [retakeError, setRetakeError] = useState<string | null>(null);

  const reviewId = openKey?.startsWith("review:")
    ? Number(openKey.slice("review:".length))
    : null;

  async function handleRetake() {
    if (retakeId === null) return;
    setRetakeBusy(true);
    setRetakeError(null);
    try {
      const res = await fetch(`/api/admin/attempts/${retakeId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRetakeError(data.error ?? "Could not retake that attempt.");
        return;
      }
      setRetakeId(null);
      router.refresh();
    } catch {
      setRetakeError("Could not retake that attempt.");
    } finally {
      setRetakeBusy(false);
    }
  }

  if (students.length === 0) {
    return (
      <div className="card px-5 py-4 text-sm text-slate-500">{emptyLabel}</div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-3">Student</th>
              <th scope="col" className="px-5 py-3">Gender</th>
              <th scope="col" className="px-5 py-3">Subjects</th>
              <th scope="col" className="px-5 py-3">Attempts</th>
              <th scope="col" className="px-5 py-3">Avg score</th>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Expand details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student) => {
              const key = `student:${student.id}`;
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
                    <td className="px-5 py-3">
                      {student.gender === "MALE" ? (
                        <span className="badge bg-sky-50 text-sky-700">Male</span>
                      ) : student.gender === "FEMALE" ? (
                        <span className="badge bg-pink-50 text-pink-700">Female</span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {student.subjects.length === 0 ? (
                        <span className="text-slate-400">&mdash;</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {student.subjects.slice(0, 3).map((subject) => (
                            <span
                              key={subject}
                              className="badge bg-slate-100 text-slate-600"
                            >
                              {subject}
                            </span>
                          ))}
                          {student.subjects.length > 3 ? (
                            <span className="badge bg-slate-100 text-slate-500">
                              {`+${student.subjects.length - 3}`}
                            </span>
                          ) : null}
                        </span>
                      )}
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
                        onClick={() => setOpenKey(open ? null : key)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Chevron open={open} />
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-5 pb-5 pt-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Exam results
                          </p>
                          {student.attempts.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">
                              No exam attempts yet.
                            </p>
                          ) : (
                            <div className="mt-2 overflow-x-auto">
                              <table className="w-full min-w-[600px] text-sm">
                                <thead>
                                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                                    <th scope="col" className="py-2 pr-4 font-medium">Exam</th>
                                    <th scope="col" className="py-2 pr-4 font-medium">Subject</th>
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
                                          {attempt.subjectName}
                                        </td>
                                        <td className="py-2.5 pr-4 text-slate-500">
                                          {new Date(attempt.dateISO).toLocaleDateString(
                                            "en-US",
                                            { dateStyle: "medium" }
                                          )}
                                        </td>
                                        <td className="py-2.5 pr-4">
                                          {attempt.submitted ? (
                                            <span className={`badge ${scoreBadgeClass(pct)}`}>
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
                                            <div className="flex items-center justify-end gap-2">
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  setOpenKey(`review:${attempt.id}`)
                                                }
                                              >
                                                Review
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setRetakeId(attempt.id)}
                                              >
                                                Retake
                                              </button>
                                            </div>
                                          ) : null}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {canDeleteStudents ? (
                            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                              <DeleteButton
                                endpoint={`/api/admin/students/${student.id}`}
                                label="Delete student"
                                confirmText={`Permanently delete ${student.name} (${student.email})? All of their exam attempts, answers and enrollments will be removed. This cannot be undone.`}
                                requirePassword
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {retakeError ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm text-red-600">
            {retakeError}
          </p>
        ) : null}
      </div>

      {retakeId !== null ? (
        <ConfirmModal
          title="Retake exam attempt"
          message="Reset this attempt? Their answers and camera snapshots for this attempt will be deleted. They will be able to start the exam again."
          confirmLabel="Reset attempt"
          busy={retakeBusy}
          variant="danger"
          onClose={() => {
            setRetakeId(null);
            setRetakeError(null);
          }}
          onConfirm={handleRetake}
        />
      ) : null}
      {reviewId !== null ? (
        <AttemptReviewModal
          attemptId={reviewId}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </>
  );
}
