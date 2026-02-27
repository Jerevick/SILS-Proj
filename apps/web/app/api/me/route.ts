/**
 * GET /api/me — Current user's tenant context (role, feature flags, deployment mode).
 * Used by dashboard layouts and redirect logic. Requires auth + org (or super admin).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getTenantContext,
  getPackageType,
  type PackageType,
} from "@/lib/tenant-context";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export type MeResponse =
  | {
      kind: "super_admin";
      role: "SUPER_ADMIN";
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
    }
  | { kind: "no_org"; role: null; package: null; tenantId: null; featureFlags: null; deploymentMode: null };

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) {
    const body: MeResponse = {
      kind: "super_admin",
      role: "SUPER_ADMIN",
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

  const packageType = getPackageType(result.context);
  const body: MeResponse = {
    kind: "tenant",
    role: result.context.role,
    package: packageType,
    tenantId: result.context.tenantId,
    featureFlags: result.context.featureFlags,
    deploymentMode: result.context.deploymentMode,
  };
  return NextResponse.json(body);
}
