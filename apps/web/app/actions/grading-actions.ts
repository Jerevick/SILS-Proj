"use server";

/**
 * Phase 12: Server actions for AI grading and finalizing grades.
 * - AIGradingAgent: grade submission against rubric via LLM (Claude Sonnet), store AI result.
 * - FinalizeGrade: lecturer approval → update official grade, push to SIS gradebook, update mastery, notifications.
 * Scoped: only assigned lecturers (course creator) or ADMIN/OWNER can grade.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { runAIGradingAgent } from "@/lib/ai/ai-grading-agent";
import { prisma } from "@/lib/db";
import { updateMasteryFromLMSInternal } from "@/lib/competency-actions";

/** Check if current user can grade for this course (assigned lecturer or ADMIN/OWNER). */
async function canGradeForCourse(
  tenantId: string,
  courseId: string,
  role: string,
  clerkUserId: string
): Promise<boolean> {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "INSTRUCTOR") return false;
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    select: { createdBy: true },
  });
  if (!course) return false;
  return course.createdBy === clerkUserId || !course.createdBy;
}

/**
 * Run AI grading on a submission using the given rubric.
 * Stores per-criterion feedback, overall grade, confidence score in the submission.
 */
export async function runAIGrading(submissionId: string, rubricId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false as const, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false as const, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assignment: { include: { module: { select: { courseId: true } } } },
    },
  });
  if (!submission) {
    return { ok: false as const, error: "Submission not found" };
  }

  const canGrade = await canGradeForCourse(
    tenantId,
    submission.assignment.module.courseId,
    role,
    userId
  );
  if (!canGrade) {
    return { ok: false as const, error: "You do not have permission to grade this submission." };
  }

  return runAIGradingAgent({ submissionId, rubricId, tenantId });
}

/**
 * Finalize grade: lecturer approval for official record.
 * Updates submission grade/feedback, sets gradeFinalizedAt, pushes to SIS gradebook when linked,
 * updates skills graph mastery when programme module is linked, and marks human override if edited.
 */
export async function finalizeGrade(
  submissionId: string,
  payload: { grade?: string | null; feedback?: string | null }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false as const, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false as const, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: {
            select: {
              courseId: true,
              id: true,
            },
          },
        },
      },
    },
  });
  if (!submission) {
    return { ok: false as const, error: "Submission not found" };
  }

  const canGrade = await canGradeForCourse(
    tenantId,
    submission.assignment.module.courseId,
    role,
    userId
  );
  if (!canGrade) {
    return { ok: false as const, error: "You do not have permission to finalize this grade." };
  }

  const grade = payload.grade ?? submission.grade;
  const feedback = payload.feedback ?? submission.feedback;
  const humanOverride =
    payload.grade !== undefined || payload.feedback !== undefined
      ? true
      : submission.humanOverride;

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      grade: grade ?? null,
      feedback: feedback ?? null,
      humanOverride,
      gradeFinalizedAt: new Date(),
    },
  });

  // Real-time LMS–SIS sync: push to gradebook when course is linked to programme
  const link = await prisma.courseProgrammeLink.findFirst({
    where: {
      courseId: submission.assignment.module.courseId,
      programme: { department: { tenantId } },
    },
    select: { programmeModuleId: true },
  });

  if (link?.programmeModuleId && grade) {
    try {
      await prisma.programmeModuleGrade.upsert({
        where: {
          programmeModuleId_studentId: {
            programmeModuleId: link.programmeModuleId,
            studentId: submission.studentId,
          },
        },
        create: {
          programmeModuleId: link.programmeModuleId,
          studentId: submission.studentId,
          grade,
          completedAt: new Date(),
          syncedAt: new Date(),
        },
        update: {
          grade,
          completedAt: new Date(),
          syncedAt: new Date(),
        },
      });

      // Update skills graph mastery on final grade (tenant must have skills enabled)
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId },
        include: { featureFlags: true },
      });
      if (tenant?.featureFlags?.skillsGraphEnabled) {
        await updateMasteryFromLMSInternal(
          tenantId,
          submission.studentId,
          link.programmeModuleId,
          { grade, completedAt: new Date().toISOString() }
        );
      }
    } catch (e) {
      console.error("FinalizeGrade: SIS sync or mastery update failed", e);
      // Still return success; grade is saved in LMS
    }
  }

  return {
    ok: true as const,
    syncedToSis: !!link?.programmeModuleId,
  };
}

/** Update submission grade/feedback without finalizing (draft). */
export async function updateSubmissionDraft(
  submissionId: string,
  payload: { grade?: string | null; feedback?: string | null }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false as const, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false as const, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assignment: { include: { module: { select: { courseId: true } } } },
    },
  });
  if (!submission) {
    return { ok: false as const, error: "Submission not found" };
  }

  const canGrade = await canGradeForCourse(
    tenantId,
    submission.assignment.module.courseId,
    role,
    userId
  );
  if (!canGrade) {
    return { ok: false as const, error: "You do not have permission to edit this submission." };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      ...(payload.grade !== undefined && { grade: payload.grade }),
      ...(payload.feedback !== undefined && { feedback: payload.feedback }),
      humanOverride: true,
    },
  });
  return { ok: true as const };
}
