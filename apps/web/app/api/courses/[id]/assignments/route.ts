/**
 * GET /api/courses/[id]/assignments — List assignments for a course (all modules).
 * Used to navigate to assignment submissions / SpeedGrader.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type CourseAssignmentItem = {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  moduleId: string;
  moduleTitle: string;
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

  const { id: courseId } = await params;

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: result.context.tenantId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          assignments: {
            select: { id: true, title: true, type: true, dueDate: true, moduleId: true },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const assignments: CourseAssignmentItem[] = course.modules.flatMap((m) =>
    m.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate?.toISOString() ?? null,
      moduleId: a.moduleId,
      moduleTitle: m.title,
    }))
  );

  return NextResponse.json({ courseId, courseTitle: course.title, assignments });
}
