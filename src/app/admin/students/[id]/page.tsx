import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/app/ui";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdmin, ownedStudentWhere } from "@/lib/scope";
import { ageFromDateOfBirth } from "@/lib/format";

export const metadata = { title: "Student — Veritas Admin" };

export default async function AdminStudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const studentId = Number((await params).id);
  if (!Number.isInteger(studentId)) notFound();

  const db = getDb();
  const where = isAdmin(user)
    ? { id: studentId, role: "STUDENT" as const }
    : { id: studentId, ...ownedStudentWhere(user) };
  const student = await db.user.findFirst({
    where,
    select: {
      id: true,
      name: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      gender: true,
      dateOfBirth: true,
      school: true,
      course: true,
      year: true,
      schoolYear: true,
      createdAt: true,
      enrollments: {
        where: isAdmin(user) ? {} : { subject: { ownerId: user.id } },
        include: { subject: { select: { name: true } } },
      },
    },
  });
  if (!student) notFound();

  const age = ageFromDateOfBirth(student.dateOfBirth);

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/students"
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← All students
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {student.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{student.email}</p>
      </div>

      <Card className="p-6">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Gender
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.gender === "MALE" ? (
                <span className="badge bg-sky-50 text-sky-700">Male</span>
              ) : student.gender === "FEMALE" ? (
                <span className="badge bg-pink-50 text-pink-700">Female</span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Age
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {age === null
                ? "—"
                : `${age} year${age === 1 ? "" : "s"} old`}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Date of birth
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.dateOfBirth
                ? student.dateOfBirth.toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              School
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.school || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Course / Program
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.course || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Year / Grade
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.year || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              School Year
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.schoolYear || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Registered
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {student.createdAt.toLocaleDateString("en-US", {
                dateStyle: "medium",
              })}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Enrolled subjects
          </p>
          {student.enrollments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Not enrolled in any subjects yet.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {student.enrollments.map((e) => (
                <Badge key={e.subject.name} variant="slate">
                  {e.subject.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
