/**
 * GET /api/competencies?programmeId= — List competencies for a programme (Phase 9).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { tenantId } = result.context;
  const url = new URL(req.url);
  const programmeId = url.searchParams.get("programmeId");

  if (!programmeId) {
    const list = await prisma.competency.findMany({
      where: {
        programme: { department: { tenantId } },
      },
      include: {
        programme: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ programmeId: true }, { code: true }],
    });
    return NextResponse.json({ competencies: list });
  }

  const competencies = await prisma.competency.findMany({
    where: {
      programmeId,
      programme: { department: { tenantId } },
    },
    include: {
      programme: { select: { id: true, name: true, code: true } },
    },
    orderBy: { code: true },
  });
  return NextResponse.json({ competencies });
}
