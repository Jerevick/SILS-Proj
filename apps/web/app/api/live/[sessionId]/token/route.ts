/**
 * GET /api/live/[sessionId]/token — Get join token/URL for the live session (Daily.co or LiveKit).
 * Participants use this to join the video room. Lecturer gets owner token; students get participant.
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
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const isLecturer =
    session.createdBy === userId ||
    result.context.role === "OWNER" ||
    result.context.role === "ADMIN" ||
    result.context.role === "INSTRUCTOR";

  if (session.provider === "daily") {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        roomUrl: session.roomUrl,
        token: null,
        error: "Daily.co not configured (DAILY_API_KEY). Use roomUrl for meet.daily.co if available.",
      });
    }
    // If we don't have a room yet, create one
    let roomName = session.externalRoomId;
    let roomUrl = session.roomUrl;
    if (!roomName) {
      try {
        const res = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `sils-${session.id.slice(-8)}-${Date.now().toString(36)}`,
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
          roomName = data.name;
          roomUrl = data.url;
          await prisma.liveSession.update({
            where: { id: sessionId },
            data: { externalRoomId: roomName!, roomUrl },
          });
        }
      } catch {
        // ignore
      }
    }
    if (!roomName || !roomUrl) {
      return NextResponse.json(
        { error: "Could not create or find Daily room" },
        { status: 502 }
      );
    }
    // Daily meeting tokens: optional for private rooms; for open rooms roomUrl is enough
    const meetingToken = await (async () => {
      try {
        const res = await fetch("https://api.daily.co/v1/meeting-tokens", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              room_name: roomName,
              user_name: userId,
              is_owner: isLecturer,
              enable_screenshare: true,
              start_audio_off: false,
              start_video_off: false,
            },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { token: string };
          return data.token;
        }
      } catch {
        // ignore
      }
      return null;
    })();

    return NextResponse.json({
      roomUrl,
      token: meetingToken,
      provider: "daily",
      isLecturer,
    });
  }

  // LiveKit: return room name + token from LiveKit server SDK (not implemented here; requires LIVEEKIT_URL + API_KEY + API_SECRET)
  if (session.provider === "livekit") {
    return NextResponse.json({
      roomUrl: session.roomUrl,
      token: null,
      provider: "livekit",
      isLecturer,
      error: "LiveKit token generation not configured. Set LIVEEKIT_URL, LIVEEKIT_API_KEY, LIVEEKIT_API_SECRET and use LiveKit server SDK to create tokens.",
    });
  }

  return NextResponse.json(
    { error: "Unknown provider" },
    { status: 400 }
  );
}
