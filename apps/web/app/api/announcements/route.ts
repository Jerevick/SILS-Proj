/**
 * GET /api/announcements — Announcements feed for current user (scoped, filtered).
 * Phase 17: Centralized announcements. Query: scopeFilter, from, to.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAnnouncementsForUser } from "@/app/actions/announcement-actions";
import type { AnnouncementScopeType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeFilter = searchParams.get("scopeFilter") as AnnouncementScopeType | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const result = await getAnnouncementsForUser({
    scopeFilter: scopeFilter ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ items: result.items });
}
