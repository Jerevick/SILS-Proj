/**
 * GET /api/progress/[studentId] — N-of-1 progress: modules with mastery, pathway step, friction.
 * Allowed for the student themselves or instructors/admins in the same tenant.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type ModuleProgressItem = {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  order: number;
  masteryScore: number | null;
  currentPathwayStep: number | null;
  frictionHistory: unknown;
  updatedAt: string;
};

export type ProgressPayload = {
  studentId: string;
  modules: ModuleProgressItem[];
  /** Predicted gaps: module IDs where mastery is low or friction is high. */
  predictedGaps: string[];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { studentId } = await params;
  const { tenantId, role } = result.context;
  const isInstructor =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  const isSelf = studentId === userId;
  if (!isInstructor && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const progressRows = await prisma.studentModuleProgress.findMany({
      where: { tenantId, studentId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            order: true,
            courseId: true,
            course: { select: { title: true } },
          },
        },
      },
      orderBy: [{ module: { courseId: true } }, { module: { order: true } }],
    });

    const modules: ModuleProgressItem[] = progressRows.map((p) => ({
      moduleId: p.module.id,
      moduleTitle: p.module.title,
      courseId: p.module.courseId,
      courseTitle: p.module.course.title,
      order: p.module.order,
      masteryScore: p.masteryScore,
      currentPathwayStep: p.currentPathwayStep,
      frictionHistory: p.frictionHistory,
      updatedAt: p.updatedAt.toISOString(),
    }));

    const predictedGaps = progressRows
      .filter((p) => {
        const lowMastery = p.masteryScore != null && p.masteryScore < 0.5;
        const history = p.frictionHistory as unknown[] | null;
        const highFriction = Array.isArray(history) && history.length >= 3;
        return lowMastery || highFriction;
      })
      .map((p) => p.moduleId);

    const payload: ProgressPayload = {
      studentId,
      modules,
      predictedGaps,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Get progress error:", e);
    return NextResponse.json(
      { error: "Failed to load progress." },
      { status: 500 }
    );
  }
}
