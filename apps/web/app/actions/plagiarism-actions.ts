"use server";

/**
 * Phase 22: Server actions for plagiarism & originality checking.
 * RunPlagiarismCheck: runs external service (Turnitin/Copyleaks stub) or AI-native similarity
 * via LLM_Router, stores PlagiarismReport linked to submission.
 * Scoped: only assigned lecturers (course creator) or ADMIN/OWNER can run checks and view full reports.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runPlagiarismSimilarityAgent } from "@/lib/ai/plagiarism-similarity-agent";
import type { PlagiarismReportProvider } from "@prisma/client";

/** Check if current user can grade (and thus run plagiarism) for this course. */
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

export type RunPlagiarismCheckInput = {
  submission_id: string;
  content_text: string;
};

export type RunPlagiarismCheckResult =
  | { ok: true; reportId: string }
  | { ok: false; error: string };

/**
 * Run plagiarism/originality check for a submission.
 * Uses AI-native similarity when no external provider is configured; otherwise
 * can call Turnitin LTI stub or Copyleaks API (stub placeholders).
 * Stores report and links it to the submission.
 */
export async function RunPlagiarismCheck(
  input: RunPlagiarismCheckInput
): Promise<RunPlagiarismCheckResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  const submission = await prisma.submission.findFirst({
    where: { id: input.submission_id },
    include: {
      assignment: { include: { module: { select: { courseId: true } } } },
    },
  });

  if (!submission) {
    return { ok: false, error: "Submission not found" };
  }

  const canGrade = await canGradeForCourse(
    tenantId,
    submission.assignment.module.courseId,
    role,
    userId
  );
  if (!canGrade) {
    return { ok: false, error: "You do not have permission to run plagiarism checks for this submission." };
  }

  // Prefer content_text from caller (e.g. SpeedGrader); fallback to stored content
  const contentText = (input.content_text || submission.content || "").trim();
  if (!contentText) {
    return { ok: false, error: "No text content to check." };
  }

  // External providers: stub for future Turnitin LTI / Copyleaks API
  // const turnitinUrl = process.env.TURNITIN_LTI_REPORT_URL;
  // const copyleaksKey = process.env.COPYLEAKS_API_KEY;
  // if (turnitinUrl) { ... create report via LTI, then store with provider TURNITIN }
  // else if (copyleaksKey) { ... create scan via Copyleaks API, then store with provider COPYLEAKS }

  // Default: AI-native similarity check via LLM_Router
  const agentResult = await runPlagiarismSimilarityAgent({
    contentText,
    tenantId,
  });

  if (!agentResult.ok) {
    return { ok: false, error: agentResult.error };
  }

  const { overallScore, detailedMatches } = agentResult.payload;
  const report = await prisma.plagiarismReport.create({
    data: {
      submissionId: input.submission_id,
      overallScore,
      detailedMatches: detailedMatches as object,
      reportUrl: null,
      provider: "ai_native" as PlagiarismReportProvider,
    },
  });

  return { ok: true, reportId: report.id };
}
