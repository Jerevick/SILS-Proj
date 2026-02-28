/**
 * Analytics (BI Dashboard) access: Institution Admin, Dean, Registrar, Super Admin.
 * OWNER, ADMIN = institution-level; platform staff can pass tenantId to view an institution.
 */

import type { UserRole } from "@prisma/client";

/** Can access institutional analytics / BI dashboard. */
export function canAccessAnalytics(role: UserRole | string | null): boolean {
  if (!role) return false;
  return role === "OWNER" || role === "ADMIN";
}
