/**
 * GET /api/equity — Equity dashboard data for the current institution (tenant).
 * Uses auth org to resolve tenant. For institution admins / SIS users.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type EquityDashboardPayload = {
  tenantId: string;
  tenantName: string;
  totalLearners: number;
  learnersWithEquityData: number;
  completionRateOverall: number;
  byDemographic: {
    firstGen: { count: number; completed: number; rate: number };
    lowIncome: { count: number; completed: number; rate: number };
    neurodiverse: { count: number; completed: number; rate: number };
    caregiver: { count: number; completed: number; rate: number };
  };
};

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantId = result.context.tenantId;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const learners = await prisma.userTenantRole.findMany({
      where: { tenantId, role: "LEARNER" },
      select: { clerkUserId: true },
    });
    const totalLearners = learners.length;
    const learnerIds = learners.map((l) => l.clerkUserId);

    const [equityRows, completedInLms, completedInSis] = await Promise.all([
      prisma.equityMetric.findMany({
        where: { tenantId, studentId: { in: learnerIds } },
        select: {
          studentId: true,
          firstGen: true,
          lowIncome: true,
          neurodiverse: true,
          caregiver: true,
        },
      }),
      prisma.gradebookEntry.findMany({
        where: {
          course: { tenantId },
          studentId: { in: learnerIds },
          finalGrade: { not: null },
        },
        select: { studentId: true },
      }),
      prisma.programmeModuleGrade.findMany({
        where: {
          programmeModule: { programme: { department: { tenantId } } },
          studentId: { in: learnerIds },
          completedAt: { not: null },
        },
        select: { studentId: true },
      }),
    ]);

    const completedSet = new Set<string>([
      ...completedInLms.map((r) => r.studentId),
      ...completedInSis.map((r) => r.studentId),
    ]);
    const completedCount = completedSet.size;
    const completionRateOverall =
      totalLearners > 0 ? Math.round((completedCount / totalLearners) * 100) : 0;

    const byDemographic = {
      firstGen: { count: 0, completed: 0, rate: 0 },
      lowIncome: { count: 0, completed: 0, rate: 0 },
      neurodiverse: { count: 0, completed: 0, rate: 0 },
      caregiver: { count: 0, completed: 0, rate: 0 },
    };
    for (const e of equityRows) {
      const completed = completedSet.has(e.studentId);
      if (e.firstGen) {
        byDemographic.firstGen.count++;
        if (completed) byDemographic.firstGen.completed++;
      }
      if (e.lowIncome) {
        byDemographic.lowIncome.count++;
        if (completed) byDemographic.lowIncome.completed++;
      }
      if (e.neurodiverse) {
        byDemographic.neurodiverse.count++;
        if (completed) byDemographic.neurodiverse.completed++;
      }
      if (e.caregiver) {
        byDemographic.caregiver.count++;
        if (completed) byDemographic.caregiver.completed++;
      }
    }
    for (const key of Object.keys(byDemographic) as (keyof typeof byDemographic)[]) {
      const d = byDemographic[key];
      d.rate = d.count > 0 ? Math.round((d.completed / d.count) * 100) : 0;
    }

    const payload: EquityDashboardPayload = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      totalLearners,
      learnersWithEquityData: equityRows.length,
      completionRateOverall,
      byDemographic,
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("Equity API error:", e);
    return NextResponse.json(
      { error: "Failed to load equity data." },
      { status: 500 }
    );
  }
}
