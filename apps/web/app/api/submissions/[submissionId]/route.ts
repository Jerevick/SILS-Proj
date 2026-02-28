/**
 * GET /api/submissions/[submissionId] — Single submission for SpeedGrader.
 * Returns submission with assignment, module, course, rubrics. Scoped to tenant; graders only.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type SpeedGraderSubmissionPayload = {
  id: string;
  studentId: string;
  content: string | null;
  attachmentsJson: unknown;
  grade: string | null;
  feedback: string | null;
  aiGrade: unknown;
  aiFeedback: string | null;
  confidenceScore: number | null;
  humanOverride: boolean;
  gradeFinalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignment: {
    id: string;
    title: string;
    type: string;
    dueDate: string | null;
    moduleId: string;
    module: {
      id: string;
      title: string;
      courseId: string;
      course: { id: string; title: string; tenantId: string };
    };
    rubricId: string | null;
    rubric: { id: string; name: string; criteria: unknown } | null;
  };
  rubrics: { id: string; name: string; criteria: unknown }[];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { submissionId } = await params;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: {
            include: {
              course: true,
              rubrics: { select: { id: true, name: true, criteria: true } },
            },
          },
          rubric: { select: { id: true, name: true, criteria: true } },
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.assignment.module.course.tenantId !== result.context.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload: SpeedGraderSubmissionPayload = {
    id: submission.id,
    studentId: submission.studentId,
    content: submission.content,
    attachmentsJson: submission.attachmentsJson,
    grade: submission.grade,
    feedback: submission.feedback,
    aiGrade: submission.aiGrade,
    aiFeedback: submission.aiFeedback,
    confidenceScore: submission.confidenceScore,
    humanOverride: submission.humanOverride,
    gradeFinalizedAt: submission.gradeFinalizedAt?.toISOString() ?? null,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    assignment: {
      id: submission.assignment.id,
      title: submission.assignment.title,
      type: submission.assignment.type,
      dueDate: submission.assignment.dueDate?.toISOString() ?? null,
      moduleId: submission.assignment.moduleId,
      module: {
        id: submission.assignment.module.id,
        title: submission.assignment.module.title,
        courseId: submission.assignment.module.courseId,
        course: {
          id: submission.assignment.module.course.id,
          title: submission.assignment.module.course.title,
          tenantId: submission.assignment.module.course.tenantId,
        },
      },
      rubricId: submission.assignment.rubricId,
      rubric: submission.assignment.rubric,
    },
    rubrics: submission.assignment.module.rubrics,
  };

  return NextResponse.json(payload);
}
