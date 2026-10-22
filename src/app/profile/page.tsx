import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import ProfileForm from "@/components/profile-form";

export const metadata = { title: "Profile — Veritas" };

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      dateOfBirth: true,
      school: true,
      designation: true,
      course: true,
      year: true,
      schoolYear: true,
    },
  });
  if (!record) {
    // The session is valid but the row is gone; force a re-resolve.
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-none px-6 py-10 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your name, age and school. Your instructor can see these.
        </p>
      </div>
      <ProfileForm
        initial={{
          firstName: record.firstName ?? "",
          middleName: record.middleName ?? "",
          lastName: record.lastName ?? "",
          dateOfBirth: toDateInput(record.dateOfBirth),
          school: record.school ?? "",
          designation: record.designation ?? "",
          course: record.course ?? "",
          year: record.year ?? "",
          schoolYear: record.schoolYear ?? "",
        }}
      />
    </main>
  );
}
