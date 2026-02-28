/**
 * GET /api/assignments/[assignmentId]/submissions — List submissions for an assignment.
 * Returns submissions with AI grading status. Scoped to tenant; graders only.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type SubmissionListItem = {
  id: string;
  studentId: string;
  grade: string | null;
  feedback: string | null;
  aiGradingStatus: "none" | "ai_suggested" | "finalized";
  confidenceScore: number | null;
  gradeFinalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { assignmentId } = await params;

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId },
    include: {
      module: { include: { course: true } },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (assignment.module.course.tenantId !== result.context.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await prisma.submission.findMany({
    where: { assignmentId },
    orderBy: { updatedAt: "desc" },
  });

  const rows: SubmissionListItem[] = submissions.map((s) => {
    let aiGradingStatus: SubmissionListItem["aiGradingStatus"] = "none";
    if (s.gradeFinalizedAt) aiGradingStatus = "finalized";
    else if (s.aiGrade != null || s.aiFeedback != null) aiGradingStatus = "ai_suggested";

    return {
      id: s.id,
      studentId: s.studentId,
      grade: s.grade,
      feedback: s.feedback,
      aiGradingStatus,
      confidenceScore: s.confidenceScore,
      gradeFinalizedAt: s.gradeFinalizedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    assignmentId,
    assignmentTitle: assignment.title,
    courseId: assignment.module.courseId,
    courseTitle: assignment.module.course.title,
    submissions: rows,
  });
}
