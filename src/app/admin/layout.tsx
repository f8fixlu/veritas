import NavBar from "@/components/nav-bar";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin — Veritas" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
