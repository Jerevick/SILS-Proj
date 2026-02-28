/**
 * Edge-safe platform admin check for middleware.
 * Uses only env vars and Clerk (no Prisma). Use in middleware only.
 * For full check (env + DB), use isSuperAdmin from @/lib/platform-auth in API routes.
 */

import { clerkClient } from "@clerk/nextjs/server";

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

/**
 * Returns true only if userId is a super admin via env (CLERK_USER_IDS or EMAILS).
 * Does not check DB - use in middleware only. When false, request is still allowed
 * so that DB-only platform admins can reach /admin; API routes do the full check.
 */
export async function isSuperAdminEdge(userId: string | null): Promise<boolean> {
  if (!userId) return false;

  if (SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) return true;

  if (SUPER_ADMIN_EMAILS.length > 0) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
      if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;
    } catch {
      // ignore
    }
  }

  return false;
}
