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
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      <VersionFooter />
    </>
  );
}