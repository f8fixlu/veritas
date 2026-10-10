import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const user = await getSessionUser();
  if (user) {
    if (isStaff(user.role)) redirect("/admin");
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/subjects");
  }
  return <ForgotPasswordForm />;
}
