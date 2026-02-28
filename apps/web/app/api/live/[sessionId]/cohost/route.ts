/**
 * POST /api/live/[sessionId]/cohost — Run LiveClassCoHost AI (real-time Q&A / time cues).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { runLiveClassCoHost } from "@/lib/ai/live-class-cohost";
import { z } from "zod";

const postBodySchema = z.object({
  userRequest: z.string().min(1).max(2000),
  currentTopic: z.string().max(200).optional(),
  recentMessages: z
    .array(
      z.object({
        role: z.enum(["lecturer", "student"]),
        content: z.string(),
      })
    )
    .optional(),
});

export async function POST(
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

  const body = await req.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const isLecturer =
    session.createdBy === userId ||
    result.context.role === "OWNER" ||
    result.context.role === "ADMIN" ||
    result.context.role === "INSTRUCTOR";

  const startedAt = session.startedAt ?? session.createdAt;
  const elapsedMinutes = Math.floor(
    (Date.now() - startedAt.getTime()) / 60_000
  );

  const cohostResult = await runLiveClassCoHost({
    sessionTitle: session.title,
    recentMessages: parsed.data.recentMessages ?? [],
    currentTopic: parsed.data.currentTopic,
    elapsedMinutes,
    userRequest: parsed.data.userRequest,
    askerRole: isLecturer ? "lecturer" : "student",
  });

  if (!cohostResult.ok) {
    return NextResponse.json(
      { error: cohostResult.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    response: cohostResult.response,
    lecturerSuggestion: cohostResult.lecturerSuggestion ?? null,
    type: cohostResult.type ?? "general",
  });
}
