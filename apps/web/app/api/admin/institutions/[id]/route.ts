/**
 * PATCH /api/admin/institutions/[id] — Update institution (name, slug, deploymentMode, status).
 * DELETE /api/admin/institutions/[id] — Delete institution (super admin only).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canManageInstitutions,
  canViewInstitutions,
} from "@/lib/platform-auth";
import { z } from "zod";

const PATCH_BODY = z.object({
  name: z.string().min(1).max(256).optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
  deploymentMode: z.enum(["SIS", "LMS", "HYBRID"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canManageInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PATCH_BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name != null) data.name = parsed.data.name;
    if (parsed.data.slug != null) data.slug = parsed.data.slug;
    if (parsed.data.deploymentMode != null)
      data.deploymentMode = parsed.data.deploymentMode;
    if (parsed.data.status != null) data.status = parsed.data.status;

    if (parsed.data.slug != null && parsed.data.slug !== existing.slug) {
      const conflict = await prisma.tenant.findUnique({
        where: { slug: parsed.data.slug },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Slug already in use." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: data as Parameters<typeof prisma.tenant.update>[0]["data"],
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      deploymentMode: updated.deploymentMode,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("Update institution error:", e);
    return NextResponse.json(
      { error: "Failed to update institution." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canManageInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }

    await prisma.tenant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete institution error:", e);
    return NextResponse.json(
      { error: "Failed to delete institution." },
      { status: 500 }
    );
  }
}

/** GET single institution (for view details). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canViewInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, courses: true } },
        onboardingRequests: {
          take: 1,
          orderBy: { approvedAt: "desc" },
          select: {
            id: true,
            institutionName: true,
            contactPerson: true,
            contactEmail: true,
            status: true,
          },
        },
      },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      clerkOrgId: tenant.clerkOrgId,
      deploymentMode: tenant.deploymentMode,
      status: tenant.status,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
      paymentVerifiedAt: (tenant as { paymentVerifiedAt?: Date | null }).paymentVerifiedAt?.toISOString() ?? null,
      _count: tenant._count,
      onboardingRequest: tenant.onboardingRequests[0] ?? null,
    });
  } catch (e) {
    console.error("Get institution error:", e);
    return NextResponse.json(
      { error: "Failed to load institution." },
      { status: 500 }
    );
  }
}
