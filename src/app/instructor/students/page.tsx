import StudentsPage from "@/components/admin/students-page";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Students — Veritas Instructor" };

export default async function InstructorStudentsRoute({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    page?: string;
    newPage?: string;
    q?: string;
    nq?: string;
    status?: string;
  }>;
}) {
  const user = await requireStaff();
  return <StudentsPage user={user} searchParams={searchParams} />;
}
