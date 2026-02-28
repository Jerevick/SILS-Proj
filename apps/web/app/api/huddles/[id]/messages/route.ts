/**
 * GET /api/huddles/[id]/messages — List messages (tenant-scoped, paginated).
 * POST /api/huddles/[id]/messages — Send a message (participants only; huddle must be ACTIVE).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const postBodySchema = z.object({
  content: z.string().min(1).max(4000),
});

export async function GET(
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

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  const messages = await prisma.huddleMessage.findMany({
    where: { huddleId: id },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    messages: items.map((m) => ({
      id: m.id,
      huddleId: m.huddleId,
      authorId: m.authorId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor,
  });
}

export async function POST(
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

  if (huddle.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Cannot send messages to an ended huddle" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const message = await prisma.huddleMessage.create({
    data: {
      huddleId: id,
      authorId: userId,
      content: parsed.data.content,
    },
  });

  return NextResponse.json({
    id: message.id,
    huddleId: message.huddleId,
    authorId: message.authorId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
}
