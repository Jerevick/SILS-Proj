import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

export const ONBOARDING_DEPLOYMENT_MODES = [
  { value: "LMS", label: "LMS-Only", description: "Learning Management System only. Courses, content, and AI coaching—no SIS." },
  { value: "HYBRID", label: "Hybrid Bridge", description: "Connect your existing SIS to SILS. Roster sync, grade passback, single learning layer." },
  { value: "SIS", label: "Unified Blended", description: "Full SIS and LMS in one platform. One data model, one source of truth." },
] as const;

export const ACCREDITATION_STATUS_OPTIONS = [
  "Accredited",
  "Not accredited",
  "In progress",
  "Not applicable",
] as const;

export const INSTITUTION_TYPE_OPTIONS = [
  "Public university",
  "Private university",
  "Community college",
  "K-12 school",
  "K-12 district",
  "Training provider",
  "Corporate learning",
  "Other",
] as const;

export const onboardingRequestSchema = z
  .object({
    deploymentMode: z.enum(["SIS", "LMS", "HYBRID"]),
    institutionName: z.string().min(2, "Institution name is required").max(200),
    slug: z
      .string()
      .min(2, "Slug must be at least 2 characters")
      .max(50)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase letters, numbers, and hyphens only (e.g. acme-university)"
      )
      .optional(),
    contactPerson: z.string().min(2, "Contact person is required").max(120),
    contactEmail: z.string().email("Valid email is required"),
    phone: z
      .string()
      .max(30)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),
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

    addressLine1: z.string().max(200).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    addressLine2: z.string().max(200).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    addressCity: z.string().max(100).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    addressStateRegion: z.string().max(100).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    addressPostalCode: z.string().max(20).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),

    yearFounded: z
      .number()
      .int()
      .min(1000)
      .max(new Date().getFullYear() + 1)
      .optional()
      .nullable(),
    institutionType: z.string().max(80).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    legalEntityName: z.string().max(200).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    taxIdOrRegistrationNumber: z.string().max(80).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    accreditationStatus: z.enum(ACCREDITATION_STATUS_OPTIONS).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    accreditationBody: z.string().max(200).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    accreditationCertificateUrl: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    missionOrDescription: z.string().max(2000).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    numberOfCampuses: z.number().int().min(1).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.phone == null || data.phone === "") return true;
      return isValidPhoneNumber(data.phone);
    },
    { message: "Please enter a valid phone number", path: ["phone"] }
  );

export type OnboardingRequestInput = z.infer<typeof onboardingRequestSchema>;
