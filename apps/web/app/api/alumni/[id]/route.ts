/**
 * GET /api/alumni/[id] — Single alumni profile by profile id.
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER (read).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessAlumni } from "@/lib/alumni-career-auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
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

  if (!canAccessAlumni(tenantResult.context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const profile = await prisma.alumniProfile.findFirst({
    where: { id, tenantId: tenantResult.context.tenantId },
    include: { user: { select: { clerkUserId: true, firstName: true, lastName: true, email: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Alumni not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: profile.id,
    userId: profile.user.clerkUserId,
    name: [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ") || "Alumni",
    email: profile.user.email,
    graduationYear: profile.graduationYear,
    degree: profile.degree,
    currentEmployer: profile.currentEmployer,
    currentRole: profile.currentRole,
    linkedinUrl: profile.linkedinUrl,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  });
}
