/**
 * GET /api/huddles — List huddles for current tenant (optional courseId filter).
 * POST /api/huddles — Create a new huddle (Lecturer/Admin/Owner or same-tenant participant).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const createBodySchema = z.object({
  title: z.string().min(1).max(300),
  courseId: z.string().cuid().optional(),
  moduleId: z.string().optional(),
});

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId") ?? undefined;
  const status = searchParams.get("status"); // ACTIVE | ENDED

  const where = {
    tenantId: result.context.tenantId,
    ...(courseId && { courseId }),
    ...(status === "ACTIVE" && { status: "ACTIVE" as const }),
    ...(status === "ENDED" && { status: "ENDED" as const }),
  };

  const huddles = await prisma.huddle.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(
    huddles.map((h) => ({
      id: h.id,
      tenantId: h.tenantId,
      courseId: h.courseId,
      moduleId: h.moduleId,
      title: h.title,
      createdBy: h.createdBy,
      status: h.status,
      startedAt: h.startedAt.toISOString(),
      endedAt: h.endedAt?.toISOString() ?? null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
      messageCount: h._count.messages,
    }))
  );
}

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const huddle = await prisma.huddle.create({
    data: {
      tenantId: result.context.tenantId,
      title: parsed.data.title,
      courseId: parsed.data.courseId ?? null,
      moduleId: parsed.data.moduleId ?? null,
      createdBy: userId,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    id: huddle.id,
    tenantId: huddle.tenantId,
    courseId: huddle.courseId,
    moduleId: huddle.moduleId,
    title: huddle.title,
    createdBy: huddle.createdBy,
    status: huddle.status,
    startedAt: huddle.startedAt.toISOString(),
    endedAt: huddle.endedAt?.toISOString() ?? null,
    createdAt: huddle.createdAt.toISOString(),
    updatedAt: huddle.updatedAt.toISOString(),
  });
}
