import AssessmentListPage from "@/components/admin/assessment-list-page";

export const metadata = { title: "Exams" };

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; page?: string; q?: string }>;
}) {
  return (
    <AssessmentListPage kind="EXAM" searchParams={searchParams} />
  );
}
