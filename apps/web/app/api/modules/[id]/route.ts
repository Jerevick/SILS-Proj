/**
 * GET /api/modules/[id] — Get a single LMS module with course, dynamic content, pathways.
 * Optional: include current user's progress (StudentModuleProgress) when authenticated.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type ModuleDetailPayload = {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  order: number;
  contentType: string | null;
  contentJson: unknown;
  dynamicContent: unknown;
  adaptivePathways: unknown;
  createdAt: string;
  updatedAt: string;
  _count: { assignments: number };
  /** Present when authenticated; current user's progress for this module. */
  myProgress?: {
    masteryScore: number | null;
    currentPathwayStep: number | null;
    frictionHistory: unknown;
  };
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const moduleRow = await prisma.module.findFirst({
      where: {
        id,
        course: { tenantId: result.context.tenantId },
      },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { assignments: true } },
      },
    });

    if (!moduleRow) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    let myProgress: ModuleDetailPayload["myProgress"] | undefined;
    const progressRow = await prisma.studentModuleProgress.findUnique({
      where: {
        tenantId_studentId_moduleId: {
          tenantId: result.context.tenantId,
          studentId: userId,
          moduleId: id,
        },
      },
    });
    if (progressRow) {
      myProgress = {
        masteryScore: progressRow.masteryScore,
        currentPathwayStep: progressRow.currentPathwayStep,
        frictionHistory: progressRow.frictionHistory,
      };
    }

    const payload: ModuleDetailPayload = {
      id: moduleRow.id,
      courseId: moduleRow.courseId,
      courseTitle: moduleRow.course.title,
      title: moduleRow.title,
      order: moduleRow.order,
      contentType: moduleRow.contentType,
      contentJson: moduleRow.contentJson,
      dynamicContent: moduleRow.dynamicContent,
      adaptivePathways: moduleRow.adaptivePathways,
      createdAt: moduleRow.createdAt.toISOString(),
      updatedAt: moduleRow.updatedAt.toISOString(),
      _count: moduleRow._count,
      myProgress,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Get module error:", e);
    return NextResponse.json(
      { error: "Failed to load module." },
      { status: 500 }
    );
  }
}
