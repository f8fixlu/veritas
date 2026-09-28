import Link from "next/link";
import DeleteButton from "@/components/admin/delete-button";
import DeleteOnlyList from "@/components/admin/delete-only-list";
import SubjectCreateForm from "@/components/admin/subject-create-form";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { isAdmin, ownedSubjectWhere } from "@/lib/scope";

export default async function AdminSubjectsPage() {
  const user = await requireStaff();

  if (isAdmin(user)) {
    // Admins have no read access to subject content: name and owner only, so
    // they can identify what to delete.
    const db = getDb();
    const subjects = await db.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, createdAt: true, owner: { select: { name: true } } },
    });

    return (
      <>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Subjects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Delete-only view. Each subject belongs to an instructor, who manages
            its exams, questions and results.
          </p>
        </div>

        <div className="mt-6">
          <DeleteOnlyList
            noun="subject"
            items={subjects.map((subject) => ({
              id: subject.id,
              name: subject.name,
              detail: `created ${formatDateTime(subject.createdAt)}`,
              ownerName: subject.owner?.name ?? "unassigned",
              confirmEndpoint: `/api/admin/subjects/${subject.id}`,
              confirmText: `Delete "${subject.name}"? All its exams, questions and results will be removed permanently.`,
            }))}
          />
        </div>
      </>
    );
  }

  const db = getDb();
  const subjects = await db.subject.findMany({
    where: ownedSubjectWhere(user),
    orderBy: { name: "asc" },
    include: {
      _count: { select: { exams: true, enrollments: true } },
    },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Subjects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Group exams by subject and control who can take them
          </p>
        </div>
        <Link href="/admin/exams" className="btn btn-secondary btn-sm">
          Go to exams
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {subjects.length === 0 ? (
          <div className="card p-12 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              No subjects yet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create your first subject using the form.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {subjects.map((subject) => (
              <li key={subject.id} className="card card-soft px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">
                      {subject.name}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {subject.description ?? "No description"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {subject._count.exams} exam
                      {subject._count.exams === 1 ? "" : "s"} ·{" "}
                      {subject._count.enrollments} student
                      {subject._count.enrollments === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Created {formatDateTime(subject.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/subjects/${subject.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Manage
                    </Link>
                    <DeleteButton
                      endpoint={`/api/admin/subjects/${subject.id}`}
                      confirmText={`Delete "${subject.name}"? All its exams, questions and results will be removed.`}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div>
          <SubjectCreateForm />
        </div>
      </div>
    </>
  );
}
