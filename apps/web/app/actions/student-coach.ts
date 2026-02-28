"use server";

/**
 * StudentCoachAgent server action.
 * Input: student_id, module_id, current_progress, friction_signals.
 * Uses LLM Router (Claude Sonnet), updates mastery state and optionally creates intervention briefs.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { runStudentCoachAgent } from "@/lib/ai/student-coach-agent";
import type { StudentCoachInput, FrictionSignalInput } from "@/lib/ai/student-coach-types";
import type { FrictionSignalType } from "@prisma/client";

export type StudentCoachActionInput = {
  studentId: string;
  moduleId: string | null;
  courseId: string | null;
  currentProgress: number;
  frictionSignals: { signalType: FrictionSignalType; payload?: Record<string, unknown> }[];
  moduleTitle?: string;
};

export async function runStudentCoach(
  input: StudentCoachActionInput
): Promise<
  | { ok: true; decision: import("@/lib/ai/student-coach-types").CoachDecision; interventionBriefCreated: boolean; notificationTriggered: boolean }
  | { ok: false; error: string }
> {
  const { userId, orgId } = await auth();
  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  if (!orgId) {
    return { ok: false, error: "No organization selected" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  // Only instructors/admins or the student themselves (when studentId matches) can run coach for a student
  const isInstructor =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  const isSelf = input.studentId === userId;
  if (!isInstructor && !isSelf) {
    return { ok: false, error: "Insufficient permission to run coach for this student" };
  }

  const coachInput: StudentCoachInput = {
    studentId: input.studentId,
    tenantId,
    moduleId: input.moduleId,
    courseId: input.courseId,
    currentProgress: input.currentProgress,
    frictionSignals: input.frictionSignals as FrictionSignalInput[],
    moduleTitle: input.moduleTitle,
  };

  const result = await runStudentCoachAgent(coachInput);

  if (result.ok) {
    return {
      ok: true,
      decision: result.decision,
      interventionBriefCreated: result.interventionBriefCreated,
      notificationTriggered: result.notificationTriggered,
    };
  }
  return { ok: false, error: result.error };
}
