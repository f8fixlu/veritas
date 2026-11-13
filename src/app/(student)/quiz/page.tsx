import { redirect } from "next/navigation";
import StudentAssessmentSections from "@/components/dashboard/student-assessment-sections";
import { isStaff, requireUser } from "@/lib/auth";
import { ButtonLink } from "@/app/ui";

export const metadata = { title: "Quizzes — Veritas" };

export default async function QuizListPage() {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Quizzes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quizzes from your enrolled subjects
          </p>
        </div>
        <ButtonLink href="/subjects" variant="secondary" size="sm">
          Subjects
        </ButtonLink>
      </div>

      <StudentAssessmentSections userId={user.id} kind="QUIZ" />
    </>
  );
}
