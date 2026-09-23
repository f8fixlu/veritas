import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import LoginForm from "@/components/auth/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    if (isStaff(user.role)) redirect("/admin");
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/subjects");
  }
  return <LoginForm />;
}