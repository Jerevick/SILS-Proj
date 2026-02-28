"use server";

/**
 * DynamicModuleBrancher server action.
 * Uses StudentCoach + LLM to fork content in real-time from friction signals.
 * Scoped to current user (student) or instructor viewing that student.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { runDynamicModuleBrancher } from "@/lib/ai/dynamic-module-brancher";
import type { FrictionSignalInput } from "@/lib/ai/student-coach-types";
import type { FrictionSignalType } from "@prisma/client";

export type DynamicBrancherActionInput = {
  studentId: string;
  moduleId: string;
  courseId: string;
  currentProgress: number;
  frictionSignals: { signalType: FrictionSignalType; payload?: Record<string, unknown> }[];
  moduleTitle?: string;
  moduleContentSummary?: string;
};

export async function runDynamicBrancher(input: DynamicBrancherActionInput) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { tenantId, role } = tenantResult.context;
  const isInstructor =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  const isSelf = input.studentId === userId;
  if (!isInstructor && !isSelf)
    return { ok: false as const, error: "Insufficient permission" };

  return runDynamicModuleBrancher({
    studentId: input.studentId,
    tenantId,
    moduleId: input.moduleId,
    courseId: input.courseId,
    currentProgress: input.currentProgress,
    frictionSignals: input.frictionSignals as FrictionSignalInput[],
    moduleTitle: input.moduleTitle,
    moduleContentSummary: input.moduleContentSummary,
  });
}
