/**
 * Server-side tenant context resolution for SILS.
 * Resolves tenant, role, feature flags, and deployment mode from Clerk org + user.
 * Used for post-sign-in redirect and role-based UI.
 */

import { prisma } from "@/lib/db";
import type { DeploymentMode, UserRole } from "@prisma/client";
import type { FeatureFlags, TenantContext } from "@sils/shared-types";

export type TenantContextResult =
  | { ok: true; context: TenantContext }
  | { ok: false; reason: "no_tenant" | "no_org" };

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  sisEnabled: false,
  skillsGraphEnabled: false,
  pwaEnabled: true,
  lowBandwidthEnabled: false,
  schoolsEnabled: false,
};

/**
 * Maps Prisma UserRole to shared-types UserRole (same values; for type safety).
 */
function toSharedRole(role: UserRole): TenantContext["role"] {
  return role as TenantContext["role"];
}

/**
 * Maps Prisma DeploymentMode to shared-types (same values).
 */
function toSharedDeploymentMode(
  mode: DeploymentMode
): TenantContext["deploymentMode"] {
  return mode as TenantContext["deploymentMode"];
}

/**
 * Resolve tenant context for the current user in the given organization.
 * Uses Clerk orgId (clerkOrgId on Tenant) and userId (clerkUserId on UserTenantRole).
 * If no UserTenantRole exists (e.g. first org admin after onboarding), defaults to ADMIN.
 */
export async function getTenantContext(
  clerkOrgId: string,
  clerkUserId: string
): Promise<TenantContextResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId },
    include: {
      featureFlags: true,
    },
  });

  if (!tenant) return { ok: false, reason: "no_tenant" };

  // Phase 15: Multiple role rows per user (tenant-wide + scoped); prefer tenant-wide for context role.
  let roleRecord = await prisma.userTenantRole.findFirst({
    where: {
      tenantId: tenant.id,
      clerkUserId,
      scopeType: null,
    },
  });
  if (!roleRecord) {
    roleRecord = await prisma.userTenantRole.findFirst({
      where: {
        tenantId: tenant.id,
        clerkUserId,
      },
    });
  }

  const role = roleRecord
    ? toSharedRole(roleRecord.role)
    : ("ADMIN" as TenantContext["role"]); // First org admin may not have DB role yet

  const featureFlags: FeatureFlags = tenant.featureFlags
    ? {
        sisEnabled: tenant.featureFlags.sisEnabled,
        skillsGraphEnabled: tenant.featureFlags.skillsGraphEnabled,
        pwaEnabled: tenant.featureFlags.pwaEnabled,
        lowBandwidthEnabled: tenant.featureFlags.lowBandwidthEnabled,
        schoolsEnabled: tenant.featureFlags.schoolsEnabled ?? false,
      }
    : DEFAULT_FEATURE_FLAGS;

  const context: TenantContext = {
    tenantId: tenant.id,
    role,
    featureFlags,
    deploymentMode: toSharedDeploymentMode(tenant.deploymentMode),
  };

  return { ok: true, context };
}

/**
 * Package type derived from deployment mode + feature flags.
 * - full_sis: SIS only — staff + SIS dashboards
 * - hybrid: Hybrid (SIS+LMS) — full SIS and LMS
 * - lms_only: LMS only — lecturer and student dashboards
 */
export type PackageType = "full_sis" | "hybrid" | "lms_only";

export function getPackageType(context: TenantContext): PackageType {
  const mode = context.deploymentMode as string;
  if (mode === "HYBRID") return "hybrid";
  if (mode === "SIS") return "full_sis";
  return "lms_only";
}
