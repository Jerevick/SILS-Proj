import { z } from "zod";

const platformRoleValues = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
] as const;
export const platformRoleSchema = z.enum(platformRoleValues);
export type PlatformRoleSchema = z.infer<typeof platformRoleSchema>;

export const platformAdminRowSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  email: z.string().nullable(),
  role: platformRoleSchema,
  status: z.string(),
  createdAt: z.string(),
});
export type PlatformAdminRowSchema = z.infer<typeof platformAdminRowSchema>;

export const platformAdminsResponseSchema = z.array(platformAdminRowSchema);
export type PlatformAdminsResponseSchema = z.infer<typeof platformAdminsResponseSchema>;

export const institutionCountSchema = z.object({
  users: z.number(),
  courses: z.number(),
});
export const onboardingRequestRefSchema = z
  .object({
    id: z.string(),
    institutionName: z.string().optional(),
    contactPerson: z.string().optional(),
    contactEmail: z.string().optional(),
    status: z.string().optional(),
  })
  .nullable();

export const institutionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  clerkOrgId: z.string().optional(),
  deploymentMode: z.string(),
  status: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paymentVerifiedAt: z.string().nullable().optional(),
  _count: institutionCountSchema.optional(),
  onboardingRequest: onboardingRequestRefSchema.optional(),
});
export type InstitutionRowSchema = z.infer<typeof institutionRowSchema>;

export const institutionsResponseSchema = z.array(institutionRowSchema);
export type InstitutionsResponseSchema = z.infer<typeof institutionsResponseSchema>;

const tenantRefSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    termsAcceptedAt: z.string().nullable().optional(),
  })
  .nullable();

export const onboardingRequestRowSchema = z.object({
  id: z.string(),
  deploymentMode: z.string(),
  institutionName: z.string(),
  slug: z.string(),
  contactPerson: z.string(),
  contactEmail: z.string(),
  phone: z.string().nullable().optional(),
  country: z.string(),
  website: z.string().nullable().optional(),
  approxStudents: z.number().nullable().optional(),
  status: z.string(),
  createdAt: z.string(),
  approvedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  tenant: tenantRefSchema.optional(),
  quotationSentAt: z.string().nullable().optional(),
  quotationInvoiceNumber: z.string().nullable().optional(),
  financialVerifiedAt: z.string().nullable().optional(),
  financialVerifiedBy: z.string().nullable().optional(),
});
export type OnboardingRequestRowSchema = z.infer<typeof onboardingRequestRowSchema>;

export const onboardingRequestsResponseSchema = z.array(onboardingRequestRowSchema);
export type OnboardingRequestsResponseSchema = z.infer<typeof onboardingRequestsResponseSchema>;
