/**
 * Platform role labels and ordered list. Safe to use in client components.
 */

export type PlatformRole =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "ONBOARDING_MANAGER"
  | "SUPPORT"
  | "AUDITOR";

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  PLATFORM_OWNER: "Platform Owner",
  PLATFORM_ADMIN: "Platform Admin",
  ONBOARDING_MANAGER: "Onboarding Manager",
  SUPPORT: "Support",
  AUDITOR: "Auditor",
};

export const PLATFORM_ROLES_ORDERED: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
];

/** Short descriptions for dashboard/UI. */
export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
  PLATFORM_OWNER:
    "Full control: manage platform staff, institutions, and onboarding.",
  PLATFORM_ADMIN:
    "Manage institutions and approve/reject onboarding. Cannot manage staff.",
  ONBOARDING_MANAGER: "Approve or reject onboarding requests only.",
  SUPPORT: "Read-only: view institutions and onboarding requests.",
  AUDITOR: "Read-only: view data for compliance and audit.",
};
