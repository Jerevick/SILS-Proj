/**
 * GET /api/advancement/campaigns — List campaigns for the tenant.
 * Scoped: Advancement Officer, Development Director, OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessAdvancement } from "@/lib/advancement-auth";
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

  if (!canAccessAdvancement(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await prisma.campaign.findMany({
    where: { tenantId: tenantResult.context.tenantId },
    include: {
      school: { select: { id: true, name: true, code: true } },
      donations: { select: { amount: true } },
    },
    orderBy: { startDate: "desc" },
  });

  const rows = list.map((c) => {
    const totalRaised = c.donations.reduce((s, d) => s + Number(d.amount), 0);
    const goal = Number(c.goalAmount);
    const progressPct = goal > 0 ? (totalRaised / goal) * 100 : 0;
    return {
      id: c.id,
      name: c.name,
      schoolId: c.schoolId,
      school: c.school,
      goalAmount: goal,
      totalRaised,
      progressPct,
      startDate: c.startDate.toISOString().slice(0, 10),
      endDate: c.endDate.toISOString().slice(0, 10),
      status: c.status,
      donorCount: c.donations.length,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ campaigns: rows });
}
