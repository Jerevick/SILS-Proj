/**
 * GET /api/students/[studentId]/portfolio — Proof-of-Mastery portfolio: competencies + VCs.
 * For the student themselves or instructors/admins in the same tenant.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { studentId } = await params;
  const { tenantId, role } = result.context;
  const isInstructor =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  const isSelf = studentId === userId;
  if (!isInstructor && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [studentCompetencies, verifiableCredentials] = await Promise.all([
    prisma.studentCompetency.findMany({
      where: { tenantId, studentId },
      include: {
        competency: {
          include: {
            programme: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { lastUpdated: "desc" },
    }),
    prisma.verifiableCredential.findMany({
      where: { tenantId, studentId, status: "ISSUED" },
      include: {
        competency: {
          include: {
            programme: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    studentId,
    competencies: studentCompetencies.map((sc) => ({
      id: sc.id,
      competencyId: sc.competencyId,
      code: sc.competency.code,
      title: sc.competency.title,
      programme: sc.competency.programme?.name,
      programmeCode: sc.competency.programme?.code,
      masteryLevel: sc.masteryLevel,
      evidenceJson: sc.evidenceJson,
      lastUpdated: sc.lastUpdated.toISOString(),
    })),
    credentials: verifiableCredentials.map((vc) => ({
      id: vc.id,
      competencyId: vc.competencyId,
      competencyCode: vc.competency.code,
      competencyTitle: vc.competency.title,
      programme: vc.competency.programme?.name,
      issuedAt: vc.issuedAt.toISOString(),
      blockchainTx: vc.blockchainTx,
      status: vc.status,
    })),
  });
}
