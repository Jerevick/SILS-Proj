"use server";

/**
 * FacultyOrchestrator server action.
 * Analyzes courses/modules for the current lecturer and returns
 * course health and AI-generated recommendations.
 */

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-context";
import { runFacultyOrchestrator } from "@/lib/ai/faculty-orchestrator";
import { prisma } from "@/lib/db";
import type { Recommendation } from "@/lib/ai/faculty-orchestrator";

export async function runOrchestrator() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { tenantId } = tenantResult.context;
  return runFacultyOrchestrator({ tenantId, lecturerId: userId });
}

/** One-click apply: persist recommendation (e.g. add scaffold to module dynamicContent). */
export async function applyOrchestratorRecommendation(rec: Recommendation) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  if (!rec.moduleId || !rec.applyPayload) {
    revalidatePath("/faculty/orchestrator");
    return { ok: true as const, applied: "acknowledged" };
  }

  try {
    const moduleRow = await prisma.module.findFirst({
      where: {
        id: rec.moduleId,
        course: { tenantId: tenantResult.context.tenantId, createdBy: userId },
      },
    });
    if (!moduleRow) return { ok: false as const, error: "Module not found or access denied" };

    const existing = (moduleRow.dynamicContent as Record<string, unknown>) ?? {};
    const suggestion = (rec.applyPayload.suggestion as string) ?? rec.description;
    const applied = {
      ...existing,
      appliedRecommendations: [
        ...(Array.isArray((existing as { appliedRecommendations?: unknown[] }).appliedRecommendations)
          ? (existing as { appliedRecommendations: unknown[] }).appliedRecommendations
          : []),
        { at: new Date().toISOString(), recId: rec.id, title: rec.title, suggestion },
      ],
    };

    await prisma.module.update({
      where: { id: rec.moduleId },
      data: { dynamicContent: applied },
    });
    revalidatePath("/faculty/orchestrator");
    revalidatePath(`/modules/${rec.moduleId}`);
    return { ok: true as const, applied: "saved" };
  } catch (e) {
    console.error("Apply recommendation error:", e);
    return { ok: false as const, error: "Failed to apply recommendation" };
  }
}
