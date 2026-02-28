/**
 * GET /api/live — List live sessions for current tenant.
 * POST /api/live — Create a live session (Lecturer/Owner/Admin). Optionally create Daily.co room.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const createBodySchema = z.object({
  title: z.string().min(1).max(300),
  courseId: z.string().cuid().optional(),
  provider: z.enum(["daily", "livekit"]).default("daily"),
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
  const status = searchParams.get("status");

  const where = {
    tenantId: result.context.tenantId,
    ...(courseId && { courseId }),
    ...(status === "SCHEDULED" && { status: "SCHEDULED" as const }),
    ...(status === "LIVE" && { status: "LIVE" as const }),
    ...(status === "ENDED" && { status: "ENDED" as const }),
  };

  const sessions = await prisma.liveSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attendanceRecords: true } } },
  });

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      courseId: s.courseId,
      title: s.title,
      createdBy: s.createdBy,
      provider: s.provider,
      externalRoomId: s.externalRoomId,
      roomUrl: s.roomUrl,
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? null,
      endedAt: s.endedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      attendanceCount: s._count.attendanceRecords,
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

  // Lecturer (or Owner/Admin) owns the session
  const canCreate =
    result.context.role === "OWNER" ||
    result.context.role === "ADMIN" ||
    result.context.role === "INSTRUCTOR";
  if (!canCreate) {
    return NextResponse.json(
      { error: "Only lecturers can create live sessions" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let externalRoomId: string | null = null;
  let roomUrl: string | null = null;

  if (parsed.data.provider === "daily") {
    const apiKey = process.env.DAILY_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `sils-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            properties: {
              enable_chat: true,
              enable_screen_share: true,
              start_audio_off: false,
              start_video_off: false,
            },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { name: string; url: string };
          externalRoomId = data.name;
          roomUrl = data.url;
        }
      } catch {
        // Fallback: create session without room; token route can create on first join
      }
    }
  }
  // LiveKit: room creation is typically server-side with LiveKit SDK; env LIVEEKIT_URL + API_KEY

  const session = await prisma.liveSession.create({
    data: {
      tenantId: result.context.tenantId,
      title: parsed.data.title,
      courseId: parsed.data.courseId ?? null,
      createdBy: userId,
      provider: parsed.data.provider,
      externalRoomId,
      roomUrl,
      status: "SCHEDULED",
    },
  });

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
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
}
