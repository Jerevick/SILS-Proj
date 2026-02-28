/**
 * GET /api/courses/[id] — Get a single course with modules (tenant-scoped).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type CourseWithModules = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  createdBy: string | null;
  mode: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  modules: {
    id: string;
    courseId: string;
    title: string;
    order: number;
    contentType: string | null;
    contentJson: unknown;
    createdAt: string;
    updatedAt: string;
    _count: { assignments: number };
  }[];
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
    const course = await prisma.course.findFirst({
      where: {
        id,
        tenantId: result.context.tenantId,
      },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { _count: { select: { assignments: true } } },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const payload: CourseWithModules = {
      id: course.id,
      tenantId: course.tenantId,
      title: course.title,
      slug: course.slug,
      description: course.description,
      createdBy: course.createdBy,
      mode: course.mode,
      published: course.published,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      modules: course.modules.map((m) => ({
        id: m.id,
        courseId: m.courseId,
        title: m.title,
        order: m.order,
        contentType: m.contentType,
        contentJson: m.contentJson,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        _count: m._count,
      })),
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Get course error:", e);
    return NextResponse.json(
      { error: "Failed to load course." },
      { status: 500 }
    );
  }
}
