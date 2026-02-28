/**
 * GET /api/whiteboard/[id] — Get whiteboard session and document snapshot (tenant-scoped).
 * PATCH /api/whiteboard/[id] — Update document snapshot (tldraw state); participants can edit.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const patchBodySchema = z.object({
  documentSnapshot: z.record(z.unknown()).optional(),
});

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

  const id = (await params).id;
  const board = await prisma.whiteboardSession.findFirst({
    where: { id, tenantId: result.context.tenantId },
  });

  if (!board) {
    return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: board.id,
    tenantId: board.tenantId,
    liveSessionId: board.liveSessionId,
    courseId: board.courseId,
    title: board.title,
    createdBy: board.createdBy,
    documentSnapshot: board.documentSnapshot,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
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

  const id = (await params).id;
  const board = await prisma.whiteboardSession.findFirst({
    where: { id, tenantId: result.context.tenantId },
  });

  if (!board) {
    return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updateData: { documentSnapshot?: unknown } = {};
  if (parsed.data.documentSnapshot !== undefined) {
    updateData.documentSnapshot = parsed.data.documentSnapshot;
  }

  const updated = await prisma.whiteboardSession.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    id: updated.id,
    tenantId: updated.tenantId,
    liveSessionId: updated.liveSessionId,
    courseId: updated.courseId,
    title: updated.title,
    createdBy: updated.createdBy,
    documentSnapshot: updated.documentSnapshot,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
