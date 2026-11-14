import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { staffBasePath } from "@/lib/staff-path";
import LoginForm from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    if (isStaff(user.role)) redirect(staffBasePath(user.role));
    if (!user.emailVerifiedAt) redirect("/verify-required");
    redirect("/overview");
  }

  const { reason } = await searchParams;
  const notice =
    reason === "evicted"
      ? "You were signed in on another device, which signed this one out. Sign in again to continue here."
      : undefined;

  return <LoginForm notice={notice} />;
}
