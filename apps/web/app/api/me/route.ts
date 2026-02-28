/**
 * GET /api/me — Current user's tenant context (role, feature flags, deployment mode).
 * For platform staff, includes platformRole for admin UI.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTenantContext,
  getPackageType,
  type PackageType,
} from "@/lib/tenant-context";
import { getPlatformContext, canManageInstitutions } from "@/lib/platform-auth";

export type MeResponse =
  | {
      kind: "platform_staff";
      role: "SUPER_ADMIN";
      platformRole: string;
      canManageInstitutions: boolean;
      package: null;
      tenantId: null;
      featureFlags: null;
      deploymentMode: null;
    }
  | {
      kind: "tenant";
      role: string;
      package: PackageType;
      tenantId: string;
      featureFlags: import("@sils/shared-types").FeatureFlags;
      deploymentMode: string;
      termsAcceptedAt: string | null;
    }
  | { kind: "no_org"; role: null; package: null; tenantId: null; featureFlags: null; deploymentMode: null };

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platformCtx = await getPlatformContext(userId);
  if (platformCtx) {
    const canManage = await canManageInstitutions(userId);
    const body: MeResponse = {
      kind: "platform_staff",
      role: "SUPER_ADMIN",
      platformRole: platformCtx.role,
      canManageInstitutions: canManage,
      package: null,
      tenantId: null,
      featureFlags: null,
      deploymentMode: null,
    };
    return NextResponse.json(body);
  }

  if (!orgId) {
    const body: MeResponse = {
      kind: "no_org",
      role: null,
      package: null,
      tenantId: null,
      featureFlags: null,
      deploymentMode: null,
    };
    return NextResponse.json(body);
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Tenant not found", reason: result.reason },
      { status: 404 }
    );
  }

  const tenantMeta = await prisma.tenant.findUnique({
    where: { id: result.context.tenantId },
    select: { termsAcceptedAt: true },
  });

  const packageType = getPackageType(result.context);
  const body: MeResponse = {
    kind: "tenant",
    role: result.context.role,
    package: packageType,
    tenantId: result.context.tenantId,
    featureFlags: result.context.featureFlags,
    deploymentMode: result.context.deploymentMode,
    termsAcceptedAt: tenantMeta?.termsAcceptedAt?.toISOString() ?? null,
  };
  return NextResponse.json(body);
}
