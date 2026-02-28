/**
 * GET /api/appointments — My appointments (as host or attendee). Query: from, to.
 * Phase 17: Appointments & office hours.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyAppointments } from "@/app/actions/appointment-actions";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const result = await getMyAppointments({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ appointments: result.appointments });
}
