import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTenantContext,
  getPackageType,
} from "@/lib/tenant-context";
import { UserRole } from "@sils/shared-types";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Staff roles that get SIS dashboards when package allows. */
const STAFF_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SUPPORT,
];

function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export default async function AuthCallbackPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const isSuperAdmin = SUPER_ADMIN_CLERK_USER_IDS.includes(userId);

  if (isSuperAdmin) {
    redirect("/admin/dashboard");
  }
  if (!orgId) {
    redirect("/no-organization");
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    redirect("/no-organization");
  }

  const { context } = result;
  const pkg = getPackageType(context);
  const role = context.role;

  // LMS-Only: only lecturer and student dashboards; staff go to generic hub
  if (pkg === "lms_only") {
    if (role === UserRole.INSTRUCTOR) redirect("/faculty/dashboard");
    if (role === UserRole.LEARNER) redirect("/student/dashboard");
    redirect("/dashboard");
  }

  // Hybrid or Full SIS: staff → SIS, instructor → faculty, learner → student
  if (isStaff(role)) redirect("/sis/dashboard");
  if (role === UserRole.INSTRUCTOR) redirect("/faculty/dashboard");
  if (role === UserRole.LEARNER) redirect("/student/dashboard");

  redirect("/dashboard");
}
