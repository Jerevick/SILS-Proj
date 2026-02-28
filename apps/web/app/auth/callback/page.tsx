import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTenantContext,
  getPackageType,
} from "@/lib/tenant-context";
import { isSuperAdmin } from "@/lib/super-admin";
import { UserRole } from "@sils/shared-types";
import { prisma } from "@/lib/db";

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

  const isSuperAdminResult = await isSuperAdmin(userId);

  if (isSuperAdminResult) {
    redirect("/admin/dashboard");
  }
  if (!orgId) {
    redirect("/no-organization");
  }

  let result;
  try {
    result = await getTenantContext(orgId, userId);
  } catch (err) {
    console.error("[auth/callback] Database unreachable:", err);
    redirect("/no-organization");
  }

  if (!result.ok) {
    redirect("/no-organization");
  }

  const { context } = result;

  // Institution must accept terms before accessing the platform. Redirect to terms if not yet accepted.
  const tenantMeta = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { termsAcceptedAt: true },
  });
  if (!tenantMeta?.termsAcceptedAt) {
    redirect("/terms/accept");
  }

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
