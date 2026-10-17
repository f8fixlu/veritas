"use client";

import { useState } from "react";
import AssignInstructorSelect from "@/components/admin/student-instructor-assign";
import DeleteButton from "@/components/admin/delete-button";
import StudentProfileModal from "@/components/student-profile-modal";
import {
  Avatar,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/ui";

export type NewlyRegisteredRow = {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  avatarData: string | null;
  email: string;
  registeredISO: string;
  activated?: boolean;
};

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
  emptyMessage = emptyLabel,
}: {
  students: NewlyRegisteredRow[];
  instructors?: { id: number; name: string; email: string }[];
  emptyLabel: string;
  emptyMessage?: string;
}) {
  const [profileStudentId, setProfileStudentId] = useState<number | null>(null);

  return (
    <>
    <Table className="table-fixed text-xs sm:text-sm">
      <TableHeader>
        <TableRow
          hover={false}
          className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          <TableHead className="w-[36%] px-3 py-3 sm:w-[35%] sm:px-5">Student</TableHead>
          <TableHead className="hidden px-5 py-3 md:table-cell">Registered</TableHead>
          <TableHead className="w-[32%] px-2 py-3 text-center sm:w-auto sm:px-5 sm:text-left">Status</TableHead>
          <TableHead className="w-[32%] px-3 py-3 text-right sm:w-auto sm:px-5">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : null}
        {students.map((student) => (
          <TableRow key={student.id}>
            <TableCell className="px-3 py-3 sm:px-5">
              <button
                type="button"
                className="flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                onClick={() => setProfileStudentId(student.id)}
              >
                <Avatar name={student.name} firstName={student.firstName} lastName={student.lastName} src={student.avatarData} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {student.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {student.email}
                  </span>
                </span>
              </button>
            </TableCell>
            <TableCell className="hidden px-5 py-3 text-xs text-slate-500 md:table-cell">
              {formatDate(student.registeredISO)}
            </TableCell>
            <TableCell className="px-2 py-3 text-center sm:px-5 sm:text-left">
              {student.activated ? (
                <Badge variant="success">Activated</Badge>
              ) : (
                <Badge variant="warning">Inactive</Badge>
              )}
            </TableCell>
            <TableCell className="px-3 py-3 sm:px-5">
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    {profileStudentId !== null ? (
      <StudentProfileModal
        studentId={profileStudentId}
        onClose={() => setProfileStudentId(null)}
      />
    ) : null}
    </>
  );
}
