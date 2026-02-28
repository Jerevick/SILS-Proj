/**
 * GET /api/live/[sessionId] — Get one live session (tenant-scoped).
 * PATCH /api/live/[sessionId] — Update session (start/end, lecturer only).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const sessionId = (await params).sessionId;
  const session = await prisma.liveSession.findFirst({
    where: { id: sessionId, tenantId: result.context.tenantId },
    include: { _count: { select: { attendanceRecords: true } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    tenantId: session.tenantId,
    courseId: session.courseId,
    title: session.title,
    createdBy: session.createdBy,
    provider: session.provider,
    externalRoomId: session.externalRoomId,
    roomUrl: session.roomUrl,
    status: session.status,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    metadata: session.metadata,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    attendanceCount: session._count.attendanceRecords,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const sessionId = (await params).sessionId;
  const session = await prisma.liveSession.findFirst({
    where: { id: sessionId, tenantId: result.context.tenantId },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.createdBy !== userId) {
    const isOwnerOrAdmin =
      result.context.role === "OWNER" || result.context.role === "ADMIN";
    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only the lecturer can update this session" },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const updates: { status?: "LIVE" | "ENDED"; startedAt?: Date; endedAt?: Date } = {};

  if (body.status === "LIVE" && session.status === "SCHEDULED") {
    updates.status = "LIVE";
    updates.startedAt = new Date();
  }
  if (body.status === "ENDED" && session.status !== "ENDED") {
    updates.status = "ENDED";
    updates.endedAt = new Date();
  }

  if (Object.keys(updates).length === 0) {
    const current = await prisma.liveSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { _count: { select: { attendanceRecords: true } } },
    });
    return NextResponse.json({
      id: current.id,
      tenantId: current.tenantId,
      courseId: current.courseId,
      title: current.title,
      createdBy: current.createdBy,
      provider: current.provider,
      externalRoomId: current.externalRoomId,
      roomUrl: current.roomUrl,
      status: current.status,
      startedAt: current.startedAt?.toISOString() ?? null,
      endedAt: current.endedAt?.toISOString() ?? null,
      createdAt: current.createdAt.toISOString(),
      updatedAt: current.updatedAt.toISOString(),
      attendanceCount: current._count.attendanceRecords,
    });
  }

  const updated = await prisma.liveSession.update({
    where: { id: sessionId },
    data: updates,
    include: { _count: { select: { attendanceRecords: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    tenantId: updated.tenantId,
    courseId: updated.courseId,
    title: updated.title,
    createdBy: updated.createdBy,
    provider: updated.provider,
    externalRoomId: updated.externalRoomId,
    roomUrl: updated.roomUrl,
    status: updated.status,
    startedAt: updated.startedAt?.toISOString() ?? null,
    endedAt: updated.endedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    attendanceCount: updated._count.attendanceRecords,
  });
}
