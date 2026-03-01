/**
 * Advancement module role checks. Scoped roles: Advancement Officer, Development Director.
 * Dean (school scope) and OWNER/ADMIN have full advancement access.
 */

import type { UserRole } from "@prisma/client";

/** Can view advancement dashboards, donors, campaigns, and run AI outreach. */
export function canAccessAdvancement(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "ADVANCEMENT_OFFICER" ||
    role === "DEVELOPMENT_DIRECTOR"
  );
}

/** Can create/edit campaigns and manage donor data (same as access for now). */
export function canManageAdvancement(role: UserRole | string): boolean {
  return canAccessAdvancement(role);
}
