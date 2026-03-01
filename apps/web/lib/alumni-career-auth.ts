/**
 * Phase 26: Alumni & Career Services role checks.
 * Scoped roles: Career Services, Alumni Relations. OWNER/ADMIN have full access.
 * LEARNER can access own career hub and alumni directory (read).
 */

import type { UserRole } from "@prisma/client";

/** Can access career hub (job board, AI coach, mentorship), manage opportunities, run career agent. */
export function canAccessCareer(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "CAREER_SERVICES" ||
    role === "ALUMNI_RELATIONS" ||
    role === "LEARNER" // Students see own career hub
  );
}

/** Can manage career opportunities, run AI career agent for any user (staff). */
export function canManageCareer(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "CAREER_SERVICES" ||
    role === "ALUMNI_RELATIONS"
  );
}

/** Can access alumni directory, events, mentorship; manage alumni profiles and events. */
export function canAccessAlumni(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "CAREER_SERVICES" ||
    role === "ALUMNI_RELATIONS" ||
    role === "LEARNER" // Students/alumni can browse directory and events
  );
}

/** Can manage alumni profiles, events, and mentorship pairings (staff). */
export function canManageAlumni(role: UserRole | string): boolean {
  return (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "CAREER_SERVICES" ||
    role === "ALUMNI_RELATIONS"
  );
}
