"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import AttemptReviewModal from "@/components/attempt-review-modal";
import ConfirmModal from "@/components/confirm-modal";
import DeleteButton from "@/components/admin/delete-button";
import StudentProfileModal from "@/components/student-profile-modal";
import {
  Avatar,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/ui";
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
  firstName: string | null;
  lastName: string | null;
  avatarData: string | null;
  email: string;
  gender: string | null;
  subjects: string[];
  avg: number | null;
  attempts: StudentAttemptRow[];
};

function scoreBadgeVariant(pct: number): "success" | "warning" | "danger" {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
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
  emptyMessage = emptyLabel,
}: {
  students: StudentTableRow[];
  canDeleteStudents: boolean;
  emptyLabel: string;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [retakeId, setRetakeId] = useState<number | null>(null);
  const [retakeBusy, setRetakeBusy] = useState(false);
  const [retakeError, setRetakeError] = useState<string | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);

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

  return (
    <>
      <Table
        className="table-fixed text-xs sm:text-sm"
        footer={
          retakeError ? (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-red-600">
              {retakeError}
            </p>
          ) : null
        }
      >
        <TableHeader>
          <TableRow
            hover={false}
            className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            <TableHead className="w-[40%] px-3 py-3 sm:w-[34%] sm:px-5">Student</TableHead>
            <TableHead className="hidden px-5 py-3 sm:table-cell">Gender</TableHead>
            <TableHead className="hidden px-5 py-3 lg:table-cell">Subjects</TableHead>
            <TableHead className="w-[22%] whitespace-nowrap px-3 py-3 text-center sm:w-auto sm:px-5 sm:text-left">
              <span className="sm:hidden">Tries</span>
              <span className="hidden sm:inline">Attempts</span>
            </TableHead>
            <TableHead className="w-[26%] whitespace-nowrap px-3 py-3 text-center sm:w-auto sm:px-5 sm:text-left">
              <span className="sm:hidden">Avg</span>
              <span className="hidden sm:inline">Avg score</span>
            </TableHead>
            <TableHead className="w-10 px-1 py-3 sm:w-12 sm:px-4">
              <span className="sr-only">Expand details</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
          {students.map((student) => {
            const key = `student:${student.id}`;
            const open = openKey === key;
            return (
              <Fragment key={key}>
                <TableRow
                  hover={!open}
                  className={`transition-colors ${open ? "bg-slate-50" : ""}`}
                >
                  <TableCell className="px-3 py-3 sm:px-5">
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-80"
                      onClick={() => setProfileStudentId(student.id)}
                    >
                      <Avatar name={student.name} firstName={student.firstName} lastName={student.lastName} src={student.avatarData} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {student.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {student.email}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden px-5 py-3 sm:table-cell">
                    {student.gender === "MALE" ? (
                      <span className="badge bg-sky-50 text-sky-700">Male</span>
                    ) : student.gender === "FEMALE" ? (
                      <span className="badge bg-pink-50 text-pink-700">
                        Female
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden px-5 py-3 lg:table-cell">
                    {student.subjects.length === 0 ? (
                      <span className="text-slate-400">&mdash;</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {student.subjects.slice(0, 3).map((subject) => (
                          <Badge key={subject} variant="slate">
                            {subject}
                          </Badge>
                        ))}
                        {student.subjects.length > 3 ? (
                          <Badge variant="slate">
                            {`+${student.subjects.length - 3}`}
                          </Badge>
                        ) : null}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3 text-center text-slate-700 sm:px-5 sm:text-left">
                    {student.attempts.length}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3 text-center sm:px-5 sm:text-left">
                    {student.avg === null ? (
                      <span className="text-slate-400">&mdash;</span>
                    ) : (
                      <Badge variant={scoreBadgeVariant(student.avg)}>
                        {`${student.avg}%`}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-3 text-right sm:px-4">
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
                  </TableCell>
                </TableRow>
                {open ? (
                  <tr>
                    <TableCell colSpan={6} className="bg-slate-50 px-5 pb-5 pt-2">
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
                                          <Badge variant={scoreBadgeVariant(pct)}>
                                            {`${attempt.score}/${attempt.total} \u00b7 ${pct}%`}
                                          </Badge>
                                        ) : (
                                          <Badge variant="warning">
                                            In progress
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="py-2.5 text-right">
                                        {attempt.submitted ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <Button
                                              variant="secondary"
                                              size="sm"
                                              onClick={() =>
                                                setOpenKey(`review:${attempt.id}`)
                                              }
                                            >
                                              Review
                                            </Button>
                                            <Button
                                              variant="secondary"
                                              size="sm"
                                              onClick={() => setRetakeId(attempt.id)}
                                            >
                                              Retake
                                            </Button>
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
                        <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setProfileStudentId(student.id)}
                          >
                            Profile
                          </Button>
                          {canDeleteStudents ? (
                            <DeleteButton
                              endpoint={`/api/admin/students/${student.id}`}
                              label="Delete student"
                              confirmText={`Permanently delete ${student.name} (${student.email})? All of their exam attempts, answers and enrollments will be removed. This cannot be undone.`}
                              requirePassword
                            />
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

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
      {profileStudentId !== null ? (
        <StudentProfileModal
          studentId={profileStudentId}
          onClose={() => setProfileStudentId(null)}
        />
      ) : null}
    </>
  );
}
