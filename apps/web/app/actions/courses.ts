"use server";

/**
 * Server actions for courses. Used with TanStack Query useMutation on the client.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import {
  buildCourseFromSyllabus,
  type AutobuildInput,
  type AutobuildResult,
} from "@/lib/autobuild-course";

export async function autoBuildCourse(
  input: AutobuildInput
): Promise<AutobuildResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { role } = result.context;
  const canCreate =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canCreate) {
    return { ok: false, error: "Insufficient role to create courses." };
  }

  return buildCourseFromSyllabus(
    result.context.tenantId,
    userId,
    input
  );
}
