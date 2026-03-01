/**
 * GET /api/advancement/donors/[id] — Single donor with donations and interactions.
 * Scoped: Advancement Officer, Development Director, OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessAdvancement } from "@/lib/advancement-auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const donor = await prisma.donor.findFirst({
    where: { id, tenantId: tenantResult.context.tenantId },
    include: {
      donations: {
        include: { campaign: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
      advancementInteractions: { orderBy: { date: "desc" } },
    },
  });

  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  const payload = {
    id: donor.id,
    name: donor.name,
    email: donor.email,
    contactId: donor.contactId,
    lifetimeValue: Number(donor.lifetimeValue),
    affinityScore: donor.affinityScore,
    lastContactDate: donor.lastContactDate?.toISOString().slice(0, 10) ?? null,
    tags: donor.tags,
    createdAt: donor.createdAt.toISOString(),
    donations: donor.donations.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      date: d.date.toISOString().slice(0, 10),
      designation: d.designation,
      receiptSent: d.receiptSent,
      campaign: d.campaign,
    })),
    interactions: donor.advancementInteractions.map((i) => ({
      id: i.id,
      type: i.type,
      notes: i.notes,
      date: i.date.toISOString().slice(0, 10),
      userId: i.userId,
    })),
  };

  return NextResponse.json(payload);
}
