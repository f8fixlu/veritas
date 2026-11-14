import NavBar from "@/components/nav-bar";
import VersionFooter from "@/components/version-footer";
import { requireStaff } from "@/lib/auth";
import { isAdmin } from "@/lib/scope";
import { redirect } from "next/navigation";

export const metadata = { title: "Overview" };

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();
  if (isAdmin(user)) redirect("/admin");

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-none px-6 py-10 lg:px-8">
        {children}
      </main>
      <VersionFooter />
    </>
  );
}
