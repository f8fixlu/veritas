import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import {
  IconBookOpen,
  IconClipboardList,
  IconLayoutDashboard,
  IconUsers,
} from "./icons";
import UserMenu from "./user-menu";

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {icon}
      <span className={icon ? "hidden md:inline" : undefined}>{label}</span>
    </Link>
  );
}

export default async function NavBar() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          href={user ? (user.role === "ADMIN" ? "/admin" : "/subjects") : "/"}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            V
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Veritas
          </span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5">
          {user?.role === "ADMIN" ? (
            <>
              <NavLink href="/admin" icon={<IconLayoutDashboard />} label="Overview" />
              <NavLink href="/admin/subjects" icon={<IconBookOpen />} label="Subjects" />
              <NavLink href="/admin/exams" icon={<IconClipboardList />} label="Exams" />
              <NavLink href="/admin/students" icon={<IconUsers />} label="Students" />
            </>
          ) : user ? (
            <>
              <NavLink href="/subjects" icon={<IconBookOpen />} label="Subjects" />
              <NavLink href="/exams" icon={<IconClipboardList />} label="Exams" />
            </>
          ) : null}
          {user ? (
            <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm ml-1">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
