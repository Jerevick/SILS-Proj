/**
 * GET /api/whiteboard — List whiteboard sessions for tenant (optional liveSessionId filter).
 * POST /api/whiteboard — Create a whiteboard (Lecturer or participant; optional link to live session).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const createBodySchema = z.object({
  title: z.string().min(1).max(300),
  liveSessionId: z.string().cuid().optional(),
  courseId: z.string().cuid().optional(),
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
  const liveSessionId = searchParams.get("liveSessionId") ?? undefined;

  const where = {
    tenantId: result.context.tenantId,
    ...(liveSessionId && { liveSessionId }),
  };

  const boards = await prisma.whiteboardSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    boards.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      liveSessionId: b.liveSessionId,
      courseId: b.courseId,
      title: b.title,
      createdBy: b.createdBy,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
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

  const board = await prisma.whiteboardSession.create({
    data: {
      tenantId: result.context.tenantId,
      title: parsed.data.title,
      liveSessionId: parsed.data.liveSessionId ?? null,
      courseId: parsed.data.courseId ?? null,
      createdBy: userId,
    },
  });

  return NextResponse.json({
    id: board.id,
    tenantId: board.tenantId,
    liveSessionId: board.liveSessionId,
    courseId: board.courseId,
    title: board.title,
    createdBy: board.createdBy,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  });
}
