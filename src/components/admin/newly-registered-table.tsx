"use client";

import AssignInstructorSelect from "@/components/admin/student-instructor-assign";
import DeleteButton from "@/components/admin/delete-button";

export type NewlyRegisteredRow = {
  id: number;
  name: string;
  email: string;
  registeredISO: string;
  activated?: boolean;
  daysOld?: number;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

/**
 * Students with no enrollment: "Newly registered" for an instructor (linked but
 * not yet enrolled) or "Unassigned" for an admin (no instructor yet, so the row
 * offers the assign-to-instructor control). Deletion always re-checks the
 * caller's own password.
 */
export default function NewlyRegisteredTable({
  students,
  instructors,
  emptyLabel,
}: {
  students: NewlyRegisteredRow[];
  instructors?: { id: number; name: string; email: string }[];
  emptyLabel: string;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-5 py-3">Student</th>
            <th scope="col" className="px-5 py-3">Registered</th>
            <th scope="col" className="px-5 py-3">Status</th>
            <th scope="col" className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((student) => (
            <tr key={student.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {initials(student.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {student.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {student.email}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-5 py-3 text-xs text-slate-500">
                {formatDate(student.registeredISO)}
              </td>
              <td className="px-5 py-3">
                {student.activated ? (
                  <span className="badge bg-emerald-50 text-emerald-700">Activated</span>
                ) : (
                  <span className="badge bg-amber-50 text-amber-700">Pending</span>
                )}
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {instructors ? (
                    <AssignInstructorSelect
                      studentId={student.id}
                      instructors={instructors}
                    />
                  ) : null}
                  <DeleteButton
                    endpoint={`/api/admin/students/${student.id}`}
                    label="Delete"
                    confirmText={`Permanently delete ${student.name} (${student.email})? All of their exam attempts, answers and enrollments will be removed. This cannot be undone.`}
                    requirePassword
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
