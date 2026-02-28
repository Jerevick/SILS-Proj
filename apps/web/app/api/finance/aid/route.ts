/**
 * GET /api/finance/aid — List financial aid applications for the tenant.
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessFinance } from "@/lib/finance-auth";
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

  if (!canAccessFinance(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await prisma.financialAidApplication.findMany({
    where: { tenantId: tenantResult.context.tenantId },
    include: {
      programme: { select: { name: true, code: true } },
      awards: { select: { id: true, awardType: true, amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = list.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    programmeName: a.programme.name,
    programmeCode: a.programme.code,
    requestedAmount: Number(a.requestedAmount),
    status: a.status,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    reviewedBy: a.reviewedBy,
    awardedAmount: a.awardedAmount != null ? Number(a.awardedAmount) : null,
    decisionDate: a.decisionDate?.toISOString() ?? null,
    aiRecommendation: a.aiRecommendation as Record<string, unknown> | null,
    decisionLetter: a.decisionLetter,
    awards: a.awards.map((x) => ({ id: x.id, awardType: x.awardType, amount: Number(x.amount) })),
    createdAt: a.createdAt.toISOString(),
  }));

  return NextResponse.json({ applications: rows });
}
