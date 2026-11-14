import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { staffBasePath } from "@/lib/staff-path";
import RegisterForm from "@/components/auth/register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    if (isStaff(user.role)) redirect(staffBasePath(user.role));
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/overview");
  }
  return <RegisterForm />;
}
