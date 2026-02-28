/**
 * Re-exports for backward compatibility. Prefer importing from @/lib/platform-auth.
 */
export {
  isSuperAdmin,
  getPlatformContext,
  hasPlatformAccess,
  canManagePlatformStaff,
  canManageInstitutions,
  canApproveOnboarding,
  canViewOnboarding,
  canViewInstitutions,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES_ORDERED,
} from "./platform-auth";
export type { PlatformContext } from "./platform-auth";
