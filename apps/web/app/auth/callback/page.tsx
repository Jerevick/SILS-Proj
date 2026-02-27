import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default async function AuthCallbackPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const isSuperAdmin = SUPER_ADMIN_CLERK_USER_IDS.includes(userId);

  if (isSuperAdmin) {
    redirect("/admin/dashboard");
  }
  if (orgId) {
    redirect("/dashboard");
  }
  redirect("/no-organization");
}
