/**
 * GET /api/career/opportunities — List career opportunities for the tenant (not expired).
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessCareer } from "@/lib/alumni-career-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!canAccessCareer(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const opportunities = await prisma.careerOpportunity.findMany({
    where: { tenantId: tenantResult.context.tenantId, expiresAt: { gte: today } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
  });

  const list = opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    company: o.company,
    location: o.location,
    type: o.type,
    description: o.description,
    postedBy: o.postedBy,
    expiresAt: o.expiresAt.toISOString().slice(0, 10),
    createdAt: o.createdAt.toISOString(),
  }));

  return NextResponse.json({ opportunities: list });
}
