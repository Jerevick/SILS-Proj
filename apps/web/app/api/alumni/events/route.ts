/**
 * GET /api/alumni/events — List events (alumni_networking, career_fair, webinar) for the tenant.
 * Query: type, from (date), to (date).
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessAlumni } from "@/lib/alumni-career-auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!canAccessAlumni(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "alumni_networking" | "career_fair" | "webinar" | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Parameters<typeof prisma.event.findMany>[0]["where"] = {
    tenantId: tenantResult.context.tenantId,
  };
  if (type && ["alumni_networking", "career_fair", "webinar"].includes(type)) {
    where.type = type;
  }
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime()) && toDate && !Number.isNaN(toDate.getTime())) {
    where.date = { gte: fromDate, lte: toDate };
  } else if (fromDate && !Number.isNaN(fromDate.getTime())) {
    where.date = { gte: fromDate };
  } else if (toDate && !Number.isNaN(toDate.getTime())) {
    where.date = { lte: toDate };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "asc" },
  });

  const list = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date.toISOString().slice(0, 10),
    type: e.type,
    description: e.description,
    location: e.location,
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ events: list });
}
