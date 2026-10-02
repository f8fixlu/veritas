import DeleteButton from "@/components/admin/delete-button";
import InstructorCreateForm from "@/components/admin/instructor-create-form";
import { requireAdmin, ROLES } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Instructors — Veritas Admin" };

export default async function AdminInstructorsPage() {
  await requireAdmin();
  const db = getDb();
  const instructors = await db.user.findMany({
    where: { role: ROLES.INSTRUCTOR },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      studentCode: true,
      createdAt: true,
      _count: { select: { ownedSubjects: true, linkedStudents: true } },
    },
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Instructors
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Each instructor owns their own subjects, exams and students — they
          cannot see or change anyone else&apos;s, and you cannot open their
          content. You create and remove their accounts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {instructors.length === 0 ? (
          <div className="card p-12 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              No instructors yet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create the first instructor account using the form.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {instructors.map((instructor) => (
              <li key={instructor.id} className="card px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">
                      {instructor.name}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {instructor.email}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>
                        {instructor._count.ownedSubjects} subject
                        {instructor._count.ownedSubjects === 1 ? "" : "s"}
                      </span>
                      <span>
                        {instructor._count.linkedStudents} linked student
                        {instructor._count.linkedStudents === 1 ? "" : "s"}
                      </span>
                      <span>added {formatDateTime(instructor.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-sm font-semibold tracking-[0.25em] text-slate-700"
                        title="Code students enter at registration"
                      >
                        {instructor.studentCode ?? "—"}
                      </span>
                      <DeleteButton
                        endpoint={`/api/admin/instructors/${instructor.id}`}
                        confirmText={
                          instructor._count.ownedSubjects > 0
                            ? `"${instructor.name}" still owns ${instructor._count.ownedSubjects} subject(s) (with their exams and results). Delete those subjects first — the removal will be refused otherwise.`
                            : instructor._count.linkedStudents > 0
                              ? `"${instructor.name}" still has ${instructor._count.linkedStudents} linked student(s). Re-assign them in the Students page first — the removal will be refused otherwise.`
                              : `Remove "${instructor.name}"? They will lose access to the staff panel immediately.`
                        }
                        label="Remove"
                        requirePassword
                      />
                    </div>
                    {!instructor.studentCode ? (
                      <p className="text-xs text-amber-600">
                        No student code yet — run the backfill script or
                        re-create this instructor.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div>
          <InstructorCreateForm />
        </div>
      </div>
    </>
  );
}
