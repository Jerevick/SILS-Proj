/**
 * POST /api/courses/autobuild — Generate course from syllabus + learning outcomes via Claude, then save.
 * Tenant-scoped; requires OWNER/ADMIN/INSTRUCTOR.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { buildCourseFromSyllabus } from "@/lib/autobuild-course";
import { z } from "zod";

const bodySchema = z.object({
  syllabus: z.string().min(1).max(50000),
  learningOutcomes: z.string().min(1).max(10000),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { role } = result.context;
  const canCreate =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canCreate) {
    return NextResponse.json(
      { error: "Insufficient role to create courses." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const buildResult = await buildCourseFromSyllabus(
    result.context.tenantId,
    userId,
    parsed.data
  );

  if (!buildResult.ok) {
    return NextResponse.json(
      { error: buildResult.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    courseId: buildResult.courseId,
    title: buildResult.title,
    slug: buildResult.slug,
  });
}
