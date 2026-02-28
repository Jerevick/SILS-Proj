/**
 * GET /api/huddles/[id] — Get one huddle (tenant-scoped).
 * PATCH /api/huddles/[id] — End huddle (creator/moderator only).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

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
  const huddle = await prisma.huddle.findFirst({
    where: { id, tenantId: result.context.tenantId },
    include: { _count: { select: { messages: true } } },
  });

  if (!huddle) {
    return NextResponse.json({ error: "Huddle not found" }, { status: 404 });
  }

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
    messageCount: huddle._count.messages,
  });
}

export async function PATCH(
  req: Request,
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
  const huddle = await prisma.huddle.findFirst({
    where: { id, tenantId: result.context.tenantId },
  });

  if (!huddle) {
    return NextResponse.json({ error: "Huddle not found" }, { status: 404 });
  }

  // Only creator (or future: moderator role) can end the huddle
  if (huddle.createdBy !== userId) {
    const isOwnerOrAdmin =
      result.context.role === "OWNER" || result.context.role === "ADMIN";
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only the moderator can end this huddle" },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const endHuddle = body.end === true;

  if (endHuddle && huddle.status === "ACTIVE") {
    await prisma.huddle.update({
      where: { id },
      data: { status: "ENDED", endedAt: new Date() },
    });
  }

  const updated = await prisma.huddle.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    tenantId: updated.tenantId,
    courseId: updated.courseId,
    moduleId: updated.moduleId,
    title: updated.title,
    createdBy: updated.createdBy,
    status: updated.status,
    startedAt: updated.startedAt.toISOString(),
    endedAt: updated.endedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    messageCount: updated._count.messages,
  });
}
