"use server";

/**
 * StudentSuccessAgent server action.
 * Input: student_id + current context. Generates privacy-first, culturally sensitive nudges
 * (wellness, motivation, time management), auto-detects equity needs and suggests adaptations.
 * Uses LLM_Router; logs to WellnessLog.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { runStudentSuccessAgent } from "@/lib/ai/student-success-agent";
import { sendNotification } from "@/app/actions/notification-actions";
import type { StudentSuccessContext } from "@/lib/ai/student-success-types";

export type StudentSuccessActionInput = {
  context: StudentSuccessContext;
};

export async function runStudentSuccess(input: StudentSuccessActionInput) {
  const { userId, orgId } = await auth();
  if (!userId) return { ok: false as const, error: "Unauthorized" };
  if (!orgId) return { ok: false as const, error: "No organization selected" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { tenantId } = tenantResult.context;
  // Only the current user gets their own nudge (student_id = userId).
  const coachInput = {
    studentId: userId,
    tenantId,
    context: input.context,
  };

  const result = await runStudentSuccessAgent(coachInput);
  if (result.ok) {
    // Notify student with wellness nudge (Phase 21)
    sendNotification(tenantId, {
      user_id: userId,
      template_name: "wellness_nudge",
      variables: {
        message: result.nudge.message,
        nudgeType: result.nudge.nudgeType ?? "OTHER",
      },
      channels: ["in_app"],
      fallback_title: "Wellness check-in",
      fallback_body: result.nudge.message,
      metadata: { wellnessLogId: result.wellnessLogId },
    }).catch((e) => console.error("StudentSuccess: notification failed", e));
    return {
      ok: true as const,
      nudge: result.nudge,
      wellnessLogId: result.wellnessLogId,
    };
  }
  return { ok: false as const, error: result.error };
}

/** Log a student's response to a wellness nudge (e.g. after "Log how I feel"). */
export async function logWellnessResponse(wellnessLogId: string, response: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { prisma } = await import("@/lib/db");
  const log = await prisma.wellnessLog.findFirst({
    where: { id: wellnessLogId, tenantId: tenantResult.context.tenantId, studentId: userId },
  });
  if (!log) return { ok: false as const, error: "Log not found" };

  await prisma.wellnessLog.update({
    where: { id: wellnessLogId },
    data: { response },
  });
  return { ok: true as const };
}

/** Get or create StudentPreference for current user; update low-bandwidth or language. */
export async function upsertStudentPreference(updates: {
  preferredLanguage?: string | null;
  lowBandwidthMode?: boolean;
  accessibilitySettings?: Record<string, unknown> | null;
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { prisma } = await import("@/lib/db");
  const prefs = await prisma.studentPreference.upsert({
    where: {
      tenantId_studentId: {
        tenantId: tenantResult.context.tenantId,
        studentId: userId,
      },
    },
    create: {
      tenantId: tenantResult.context.tenantId,
      studentId: userId,
      preferredLanguage: updates.preferredLanguage ?? undefined,
      lowBandwidthMode: updates.lowBandwidthMode ?? false,
      accessibilitySettings: updates.accessibilitySettings ?? undefined,
    },
    update: {
      ...(updates.preferredLanguage !== undefined && { preferredLanguage: updates.preferredLanguage }),
      ...(updates.lowBandwidthMode !== undefined && { lowBandwidthMode: updates.lowBandwidthMode }),
      ...(updates.accessibilitySettings !== undefined && { accessibilitySettings: updates.accessibilitySettings as object | undefined }),
    },
  });
  return { ok: true as const, preference: prefs };
}

/** Get current user's student preference (for global low-bandwidth toggle). */
export async function getMyPreference() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  const { prisma } = await import("@/lib/db");
  const prefs = await prisma.studentPreference.findUnique({
    where: {
      tenantId_studentId: { tenantId: tenantResult.context.tenantId, studentId: userId },
    },
  });
  return {
    ok: true as const,
    preference: prefs
      ? { lowBandwidthMode: prefs.lowBandwidthMode, preferredLanguage: prefs.preferredLanguage }
      : { lowBandwidthMode: false, preferredLanguage: null as string | null },
  };
}

/** Fetch data for Student Success Dashboard: recent wellness logs, preference, optional progress hint. */
export async function getSuccessDashboardData() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };

  const { prisma } = await import("@/lib/db");
  const [recentLogs, preference] = await Promise.all([
    prisma.wellnessLog.findMany({
      where: { tenantId: tenantResult.context.tenantId, studentId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, nudgeType: true, message: true, response: true, createdAt: true },
    }),
    prisma.studentPreference.findUnique({
      where: {
        tenantId_studentId: { tenantId: tenantResult.context.tenantId, studentId: userId },
      },
    }),
  ]);

  const progressHint = await prisma.studentModuleProgress.aggregate({
    where: { tenantId: tenantResult.context.tenantId, studentId: userId },
    _count: true,
  }).then((r) => r._count);

  return {
    ok: true as const,
    recentWellnessLogs: recentLogs.map((l) => ({
      id: l.id,
      nudgeType: l.nudgeType,
      message: l.message,
      response: l.response,
      createdAt: l.createdAt.toISOString(),
    })),
    preference: preference
      ? {
          preferredLanguage: preference.preferredLanguage,
          lowBandwidthMode: preference.lowBandwidthMode,
          accessibilitySettings: preference.accessibilitySettings,
        }
      : null,
    modulesInProgress: progressHint,
  };
}
