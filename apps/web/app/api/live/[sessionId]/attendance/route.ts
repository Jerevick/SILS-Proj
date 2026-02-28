/**
 * GET /api/live/[sessionId]/attendance — List attendance records for this session (lecturer or self).
 * POST /api/live/[sessionId]/attendance — Upsert attendance (join) or update engagement on leave.
 * SmartAttendanceTracker runs on the client or when posting leave event; engagement score stored here.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { computeEngagementFromMetadata } from "@/lib/ai/smart-attendance";
import type { ParticipantEvent } from "@/lib/ai/smart-attendance";
import { z } from "zod";

const postBodySchema = z.object({
  action: z.enum(["join", "leave"]),
  events: z
    .array(
      z.object({
        type: z.string(),
        timestamp: z.string(),
        elapsedSeconds: z.number().optional(),
      })
    )
    .optional(),
  sessionDurationSeconds: z.number().optional(),
});

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
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const isLecturer =
    session.createdBy === userId ||
    result.context.role === "OWNER" ||
    result.context.role === "ADMIN" ||
    result.context.role === "INSTRUCTOR";

  const records = await prisma.attendanceRecord.findMany({
    where: { liveSessionId: sessionId },
    orderBy: { joinedAt: "asc" },
  });

  // Students can only see their own record; lecturer sees all
  const filtered = isLecturer
    ? records
    : records.filter((r) => r.studentId === userId);

  return NextResponse.json({
    sessionId,
    records: filtered.map((r) => ({
      id: r.id,
      liveSessionId: r.liveSessionId,
      studentId: r.studentId,
      joinedAt: r.joinedAt.toISOString(),
      leftAt: r.leftAt?.toISOString() ?? null,
      engagementScore: r.engagementScore,
      summary:
        r.engagementScore != null
          ? r.engagementScore >= 80
            ? "High engagement"
            : r.engagementScore >= 50
              ? "Moderate engagement"
              : "Low engagement"
          : null,
    })),
  });
}

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

  const { action, events = [], sessionDurationSeconds } = parsed.data;

  if (action === "join") {
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        liveSessionId_studentId: { liveSessionId: sessionId, studentId: userId },
      },
    });
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        liveSessionId: existing.liveSessionId,
        studentId: existing.studentId,
        joinedAt: existing.joinedAt.toISOString(),
        leftAt: existing.leftAt?.toISOString() ?? null,
        engagementScore: existing.engagementScore,
      });
    }
    const record = await prisma.attendanceRecord.create({
      data: {
        liveSessionId: sessionId,
        studentId: userId,
        metadata: events.length > 0 ? { events } : undefined,
      },
    });
    return NextResponse.json({
      id: record.id,
      liveSessionId: record.liveSessionId,
      studentId: record.studentId,
      joinedAt: record.joinedAt.toISOString(),
      leftAt: record.leftAt?.toISOString() ?? null,
      engagementScore: record.engagementScore,
    });
  }

  // action === "leave": update record with leftAt and compute engagement from events
  const record = await prisma.attendanceRecord.findUnique({
    where: {
      liveSessionId_studentId: { liveSessionId: sessionId, studentId: userId },
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: "No attendance record found for this user" },
      { status: 404 }
    );
  }

  const leftAt = new Date();
  let engagementScore: number | null = record.engagementScore ?? null;
  let metadata = (record.metadata as { events?: ParticipantEvent[] }) ?? {};

  if (events.length > 0) {
    const allEvents = [
      ...((metadata.events as ParticipantEvent[]) ?? []),
      ...events,
      { type: "left" as const, timestamp: leftAt.toISOString() },
    ];
    const startAt = session.startedAt ?? session.createdAt;
    const computed = computeEngagementFromMetadata({
      sessionStartAt: startAt.toISOString(),
      events: allEvents,
      sessionDurationSeconds,
    });
    engagementScore = computed.engagementScore;
    metadata = { ...metadata, events: allEvents, computed };
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: { leftAt, engagementScore, metadata },
  });

  // Low engagement: trigger StudentCoach nudge (creates friction signal + optional intervention)
  if (engagementScore != null && engagementScore < 50 && session.courseId) {
    try {
      const { runStudentCoachAgent } = await import("@/lib/ai/student-coach-agent");
      await runStudentCoachAgent({
        tenantId: session.tenantId,
        studentId: userId,
        moduleId: null,
        courseId: session.courseId,
        currentProgress: 0,
        frictionSignals: [
          {
            signalType: "OTHER",
            payload: {
              source: "live_session",
              engagementScore,
              sessionId,
              presenceSeconds: metadata?.computed?.presenceSeconds,
            },
          },
        ],
        moduleTitle: session.title,
      });
    } catch {
      // Don't fail the request if coach fails
    }
  }

  return NextResponse.json({
    id: updated.id,
    liveSessionId: updated.liveSessionId,
    studentId: updated.studentId,
    joinedAt: updated.joinedAt.toISOString(),
    leftAt: updated.leftAt?.toISOString() ?? null,
    engagementScore: updated.engagementScore,
  });
}
