import NavBar from "@/components/nav-bar";
import VersionFooter from "@/components/version-footer";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Admin — Veritas" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-none px-6 py-10 lg:px-8">{children}</main>
      <VersionFooter />
    </>
  );
}
