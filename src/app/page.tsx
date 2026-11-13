import { redirect } from "next/navigation";
import { getSessionUser, isStaff } from "@/lib/auth";
import { staffBasePath } from "@/lib/staff-path";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isStaff(user.role) ? staffBasePath(user.role) : "/overview");
}
