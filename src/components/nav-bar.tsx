import Link from "next/link";
import Image from "next/image";
import { getSessionUser, isStaff, ROLES } from "@/lib/auth";
import {
  IconBookOpen,
  IconCirclePlay,
  IconClipboardList,
  IconGraduationCap,
  IconHelpCircle,
  IconLayoutDashboard,
  IconUsers,
} from "./icons";
import UserMenu from "./user-menu";
import { ButtonLink } from "@/app/ui";
import { staffBasePath } from "@/lib/staff-path";

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
      className={`flex h-12 min-w-0 items-center justify-center rounded-lg text-base text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:h-12 sm:w-auto sm:justify-start sm:gap-2 sm:px-4 ${
        icon ? "relative w-16 px-1" : "px-4"
      }`}
    >
      {icon}
      {icon ? (
        <>
          {/* Mobile: the icon keeps its centred position (so it lines up with
              the user avatar) and the label hangs below it as a caption.
              Labels stay hidden from sm to md by design, then sit beside the
              icon from md up. */}
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
  const staffBase = user ? staffBasePath(user.role) : "/admin";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-none items-center gap-2 px-6 sm:justify-between sm:gap-4 lg:px-8">
        <Link
          href={user ? (staff ? staffBase : "/overview") : "/"}
          className="flex shrink-0 items-center gap-2"
        >
          <Image
            src="/icons/veritas-current-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="hidden text-lg font-semibold tracking-tight text-slate-900 sm:block">
            Veritas
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:flex-none sm:justify-start">
          {staff ? (
            <>
              <NavLink href={staffBase} icon={<IconLayoutDashboard size={20} />} label="Overview" />
              <NavLink href={`${staffBase}/subjects`} icon={<IconBookOpen size={20} />} label="Subjects" />
              <NavLink href={`${staffBase}/exams`} icon={<IconClipboardList size={20} />} label="Exams" />
              <NavLink href={`${staffBase}/quiz`} icon={<IconHelpCircle size={20} />} label="Quizzes" />
              <NavLink
                href={
                  `${staffBase}/students`
                }
                icon={<IconUsers size={20} />}
                label="Students"
              />
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
              <NavLink href="/overview" icon={<IconLayoutDashboard size={20} />} label="Overview" />
              <NavLink href="/subjects" icon={<IconBookOpen size={20} />} label="Subjects" />
              <NavLink href="/exams" icon={<IconClipboardList size={20} />} label="Exams" />
              <NavLink href="/quiz" icon={<IconHelpCircle size={20} />} label="Quizzes" />
              <NavLink href="/results" icon={<IconCirclePlay size={20} />} label="Results" />
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
