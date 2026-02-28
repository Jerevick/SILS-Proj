/**
 * POST /api/huddles/[id]/moderate — Run AI moderator (summary + points of confusion).
 * Lecturer/moderator only; uses LLM_Router (HuddleModerator).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { runHuddleModerator } from "@/lib/ai/huddle-moderator";

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
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });

  if (!huddle) {
    return NextResponse.json({ error: "Huddle not found" }, { status: 404 });
  }

  // Only creator or instructor/admin can run moderator
  const isModerator =
    huddle.createdBy === userId ||
    result.context.role === "OWNER" ||
    result.context.role === "ADMIN" ||
    result.context.role === "INSTRUCTOR";
  if (!isModerator) {
    return NextResponse.json(
      { error: "Only the moderator can run AI summary" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const previousSummary =
    typeof body.previousSummary === "string" ? body.previousSummary : undefined;
  const previousConfusionPoints = Array.isArray(body.previousConfusionPoints)
    ? (body.previousConfusionPoints as string[])
    : undefined;

  const moderatorResult = await runHuddleModerator({
    messages: huddle.messages.map((m) => ({
      authorId: m.authorId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    previousSummary,
    previousConfusionPoints,
  });

  if (!moderatorResult.ok) {
    return NextResponse.json(
      { error: moderatorResult.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    summary: moderatorResult.summary,
    pointsOfConfusion: moderatorResult.pointsOfConfusion,
    suggestedPrompt: moderatorResult.suggestedPrompt ?? null,
  });
}
