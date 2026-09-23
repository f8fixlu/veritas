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
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Instructors
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Instructors have full access to subjects, exams, students and
          reports. Only admins can add or remove them.
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
                    <p className="mt-0.5 text-xs text-slate-400">
                      Added {formatDateTime(instructor.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <DeleteButton
                      endpoint={`/api/admin/instructors/${instructor.id}`}
                      confirmText={`Remove "${instructor.name}"? They will lose access to the staff panel immediately.`}
                      label="Remove"
                    />
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
