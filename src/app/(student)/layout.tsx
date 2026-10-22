import NavBar from "@/components/nav-bar";
import VersionFooter from "@/components/version-footer";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-none px-6 py-10 lg:px-8">{children}</main>
      <VersionFooter />
    </>
  );
}