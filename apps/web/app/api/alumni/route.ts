/**
 * GET /api/alumni — List alumni profiles for the tenant.
 * Query: graduationYear, degree, q (search name/employer/role).
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER (read).
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
  const graduationYear = searchParams.get("graduationYear");
  const degree = searchParams.get("degree");
  const q = searchParams.get("q")?.trim()?.toLowerCase();

  const where: Parameters<typeof prisma.alumniProfile.findMany>[0]["where"] = {
    tenantId: tenantResult.context.tenantId,
  };
  if (graduationYear) {
    const year = parseInt(graduationYear, 10);
    if (!Number.isNaN(year)) where.graduationYear = year;
  }
  if (degree) where.degree = { contains: degree, mode: "insensitive" };
  if (q) {
    where.OR = [
      { degree: { contains: q, mode: "insensitive" } },
      { currentRole: { contains: q, mode: "insensitive" } },
      { currentEmployer: { contains: q, mode: "insensitive" } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const list = await prisma.alumniProfile.findMany({
    where,
    include: { user: { select: { clerkUserId: true, firstName: true, lastName: true, email: true } } },
    orderBy: [{ graduationYear: "desc" }, { user: { lastName: "asc" } }],
  });

  const alumni = list.map((a) => ({
    id: a.id,
    userId: a.user.clerkUserId,
    name: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || "Alumni",
    email: a.user.email,
    graduationYear: a.graduationYear,
    degree: a.degree,
    currentEmployer: a.currentEmployer,
    currentRole: a.currentRole,
    linkedinUrl: a.linkedinUrl,
    createdAt: a.createdAt.toISOString(),
  }));

  return NextResponse.json({ alumni });
}
