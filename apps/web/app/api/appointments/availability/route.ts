/**
 * GET /api/appointments/availability?hostUserId=...&date=... — Bookable slots for a host on a date.
 * Phase 17: Office hours booking.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getBookableSlotsForDate } from "@/app/actions/appointment-actions";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hostUserId = searchParams.get("hostUserId");
  const date = searchParams.get("date");

  if (!hostUserId || !date) {
    return NextResponse.json(
      { error: "hostUserId and date are required" },
      { status: 400 }
    );
  }

  const result = await getBookableSlotsForDate(hostUserId, date);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ slots: result.slots });
}
