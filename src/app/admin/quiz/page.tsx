import AssessmentListPage from "@/components/admin/assessment-list-page";

export const metadata = { title: "Quizzes" };

export default async function AdminQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; page?: string; q?: string }>;
}) {
  return <AssessmentListPage kind="QUIZ" searchParams={searchParams} />;
}
