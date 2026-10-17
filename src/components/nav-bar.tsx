import Link from "next/link";
import { getSessionUser, isStaff, ROLES } from "@/lib/auth";
import {
  IconBookOpen,
  IconClipboardList,
  IconGraduationCap,
  IconLayoutDashboard,
  IconUsers,
} from "./icons";
import UserMenu from "./user-menu";
import { ButtonLink } from "@/app/ui";

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
      className={`flex h-12 min-w-0 items-center justify-center rounded-lg text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:h-11 sm:w-auto sm:justify-start sm:gap-1.5 sm:px-3 ${
        icon ? "relative w-14 px-1" : "px-3"
      }`}
    >
      {icon}
      {icon ? (
        <>
          {/* Mobile: the icon keeps its centred position (so it lines up with
              the user avatar) and the label hangs below it as a caption.
              Labels stay hidden from sm to md by design, then sit beside the
              icon from md up. */}
          <span className="absolute inset-x-0 top-full -mt-3 truncate text-center text-[10px] font-medium leading-none tracking-tight text-slate-500 sm:hidden">
            {label}
          </span>
          <span className="hidden md:inline">{label}</span>
        </>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </Link>
  );
}

export default async function NavBar() {
  const user = await getSessionUser();
  const staff = user ? isStaff(user.role) : false;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-2 sm:justify-between sm:gap-3 sm:px-4">
        <Link
          href={user ? (staff ? "/admin" : "/subjects") : "/"}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            V
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-slate-900 sm:block">
            Veritas
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:flex-none sm:justify-start">
          {staff ? (
            <>
              <NavLink href="/admin" icon={<IconLayoutDashboard size={20} />} label="Overview" />
              <NavLink href="/admin/subjects" icon={<IconBookOpen size={20} />} label="Subjects" />
              <NavLink href="/admin/exams" icon={<IconClipboardList size={20} />} label="Exams" />
              <NavLink href="/admin/students" icon={<IconUsers size={20} />} label="Students" />
              {user?.role === ROLES.ADMIN ? (
                <NavLink
                  href="/admin/instructors"
                  icon={<IconGraduationCap size={20} />}
                  label="Instructors"
                />
              ) : null}
            </>
          ) : user ? (
            <>
              <NavLink href="/subjects" icon={<IconBookOpen size={20} />} label="Subjects" />
              <NavLink href="/exams" icon={<IconClipboardList size={20} />} label="Exams" />
            </>
          ) : null}
          {user ? (
            <UserMenu user={{ name: user.name, email: user.email, role: user.role, avatarData: user.avatarData, firstName: user.firstName, lastName: user.lastName }} />
          ) : (
            <ButtonLink
              href="/login"
              variant="primary"
              size="sm"
              className="ml-1 h-11 sm:h-9"
            >
              Sign in
            </ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}
