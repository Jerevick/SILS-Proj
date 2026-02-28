/**
 * Platform (super admin) auth: role, status, and permission checks.
 * Env-based super admins are treated as PLATFORM_OWNER, ACTIVE.
 * DB PlatformAdmin rows have role + status; SUSPENDED = no access.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { PlatformRole } from "./platform-roles";
import type { PlatformStaffStatus } from "@prisma/client";

export {
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES_ORDERED,
} from "./platform-roles";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type PlatformContext = {
  role: PlatformRole;
  status: PlatformStaffStatus;
  source: "env" | "db";
};

const ENV_OWNER: PlatformContext = {
  role: "PLATFORM_OWNER",
  status: "ACTIVE",
  source: "env",
};

/** Resolve platform context for userId. Null if not platform staff or suspended. */
export async function getPlatformContext(
  userId: string | null
): Promise<PlatformContext | null> {
  if (!userId) return null;

  if (SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) return ENV_OWNER;
  if (SUPER_ADMIN_EMAILS.length > 0) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (email && SUPER_ADMIN_EMAILS.includes(email)) return ENV_OWNER;
    } catch {
      // ignore
    }
  }

  const row = await prisma.platformAdmin.findUnique({
    where: { clerkUserId: userId },
  });
  if (!row || row.status === "SUSPENDED") return null;
  return {
    role: row.role,
    status: row.status,
    source: "db",
  };
}

/** Has any platform access (including suspended = no). */
export async function hasPlatformAccess(userId: string | null): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && ctx.status === "ACTIVE";
}

/** Legacy: same as hasPlatformAccess (for isSuperAdmin callers). */
export async function isSuperAdmin(userId: string | null): Promise<boolean> {
  return hasPlatformAccess(userId);
}

// ----- Permissions (who can do what) -----

const CAN_MANAGE_PLATFORM_STAFF: PlatformRole[] = ["PLATFORM_OWNER"];
const CAN_MANAGE_INSTITUTIONS: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
];
const CAN_APPROVE_ONBOARDING: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
];
const CAN_VIEW_ONBOARDING: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
];
const CAN_VIEW_INSTITUTIONS: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
];

function hasPermission(role: PlatformRole, allowed: PlatformRole[]): boolean {
  return allowed.includes(role);
}

export async function canManagePlatformStaff(
  userId: string | null
): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && hasPermission(ctx.role, CAN_MANAGE_PLATFORM_STAFF);
}

export async function canManageInstitutions(
  userId: string | null
): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && hasPermission(ctx.role, CAN_MANAGE_INSTITUTIONS);
}

export async function canApproveOnboarding(
  userId: string | null
): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && hasPermission(ctx.role, CAN_APPROVE_ONBOARDING);
}

export async function canViewOnboarding(
  userId: string | null
): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && hasPermission(ctx.role, CAN_VIEW_ONBOARDING);
}

export async function canViewInstitutions(
  userId: string | null
): Promise<boolean> {
  const ctx = await getPlatformContext(userId);
  return ctx !== null && hasPermission(ctx.role, CAN_VIEW_INSTITUTIONS);
}
