import { redirect } from "next/navigation";
import StudentAssessmentSections from "@/components/dashboard/student-assessment-sections";
import { isStaff, requireUser } from "@/lib/auth";
import { ButtonLink } from "@/app/ui";

export const metadata = { title: "Exams — Veritas" };

export default async function ExamListPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Exams
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Exams from your enrolled subjects
          </p>
        </div>
        <ButtonLink href="/quiz" variant="secondary" size="sm">
          Quizzes
        </ButtonLink>
      </div>

      <StudentAssessmentSections userId={user.id} kind="EXAM" />
    </>
  );
}
