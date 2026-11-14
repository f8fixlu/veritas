import { redirect } from "next/navigation";
import StudentsPage from "@/components/admin/students-page";
import { requireStaff } from "@/lib/auth";
import { isAdmin } from "@/lib/scope";

export const metadata = { title: "Students" };

export default async function AdminStudentsRoute({
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
  if (!isAdmin(user)) redirect("/instructor/students");
  return <StudentsPage user={user} searchParams={searchParams} />;
}
