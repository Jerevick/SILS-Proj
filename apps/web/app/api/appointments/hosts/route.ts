/**
 * GET /api/appointments/hosts — Hosts with office hours (for booking UI).
 * Phase 17: Appointments.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getHostsWithAvailability } from "@/app/actions/appointment-actions";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getHostsWithAvailability();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ hostUserIds: result.hostUserIds });
}
