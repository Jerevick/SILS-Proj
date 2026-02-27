import { z } from "zod";

export const ONBOARDING_DEPLOYMENT_MODES = [
  { value: "LMS_ONLY", label: "LMS-Only", description: "Learning management only" },
  { value: "HYBRID_BRIDGE", label: "Hybrid Bridge", description: "LMS with SIS integration" },
  { value: "UNIFIED_BLENDED", label: "Unified Blended", description: "Full LMS + SIS unified" },
] as const;

export const onboardingRequestSchema = z.object({
  deploymentMode: z.enum(["LMS_ONLY", "HYBRID_BRIDGE", "UNIFIED_BLENDED"]),
  institutionName: z.string().min(2, "Institution name is required").max(200),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only (e.g. acme-university)"
    ),
  contactPerson: z.string().min(2, "Contact person is required").max(120),
  contactEmail: z.string().email("Valid email is required"),
  phone: z.string().max(30).optional().or(z.literal("")),
  country: z.string().min(2, "Country is required").max(100),
  website: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  approxStudents: z
    .number()
    .int()
    .min(0)
    .optional()
    .nullable(),
});

export type OnboardingRequestInput = z.infer<typeof onboardingRequestSchema>;
