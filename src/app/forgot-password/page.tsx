import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { staffBasePath } from "@/lib/staff-path";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const user = await getSessionUser();
  if (user) {
    if (isStaff(user.role)) redirect(staffBasePath(user.role));
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/overview");
  }
  return <ForgotPasswordForm />;
}
