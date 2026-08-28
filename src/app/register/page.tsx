import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RegisterForm from "@/components/auth/register-form";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) {
    if (user.role === "ADMIN") redirect("/admin");
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/subjects");
  }
  return <RegisterForm />;
}