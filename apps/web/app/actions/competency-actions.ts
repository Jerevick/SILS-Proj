"use server";

/**
 * Phase 9: Server actions for competency graph and verifiable credentials.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import {
  issueCredentialInternal,
  searchCompetenciesInternal,
  updateMasteryFromLMSInternal,
} from "@/lib/competency-actions";

export async function issueCredential(studentId: string, competencyId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const result = await getTenantContext(orgId, userId);
  if (!result.ok) return { ok: false as const, error: "Tenant not found" };
  const { role, tenantId } = result.context;
  const allowed =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR" || studentId === userId;
  if (!allowed) return { ok: false as const, error: "Forbidden" };
  return issueCredentialInternal(tenantId, studentId, competencyId);
}

export async function searchCompetencies(
  query: string,
  options?: { studentId?: string; limit?: number; minMastery?: number }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized", results: [] };
  const result = await getTenantContext(orgId, userId);
  if (!result.ok) return { ok: false as const, error: "Tenant not found", results: [] };
  return searchCompetenciesInternal(result.context.tenantId, query, options);
}

export async function updateMasteryFromLMS(
  studentId: string,
  programmeModuleId: string,
  options?: { grade?: string; completedAt?: string }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const result = await getTenantContext(orgId, userId);
  if (!result.ok) return { ok: false as const, error: "Tenant not found" };
  const { role, tenantId } = result.context;
  if (role !== "OWNER" && role !== "ADMIN" && role !== "INSTRUCTOR")
    return { ok: false as const, error: "Forbidden" };
  return updateMasteryFromLMSInternal(tenantId, studentId, programmeModuleId, options);
}
