/**
 * GET /api/advancement/donors — List donors for the tenant.
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

  const list = await prisma.donor.findMany({
    where: { tenantId: tenantResult.context.tenantId },
    include: {
      donations: {
        select: { amount: true, date: true },
        orderBy: { date: "desc" },
        take: 1,
      },
      advancementInteractions: {
        select: { date: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: { lifetimeValue: "desc" },
  });

  const rows = list.map((d) => {
    const lastDonation = d.donations[0];
    const lastInteraction = d.advancementInteractions[0];
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      lifetimeValue: Number(d.lifetimeValue),
      affinityScore: d.affinityScore,
      lastContactDate: d.lastContactDate?.toISOString().slice(0, 10) ?? null,
      lastDonationDate: lastDonation?.date.toISOString().slice(0, 10) ?? null,
      lastInteractionDate: lastInteraction?.date.toISOString().slice(0, 10) ?? null,
      tags: d.tags,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ donors: rows });
}
