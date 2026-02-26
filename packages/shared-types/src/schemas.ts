/**
 * Shared Zod schemas for SILS (API validation, env parsing).
 */
import { z } from "zod";

/** Health check API response */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string().datetime(),
});

/** Tenant slug (subdomain or header): alphanumeric, hyphen, underscore */
export const tenantSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i);

/** Optional tenant context from headers (for API routes) */
export const tenantHeaderSchema = z.object({
  "x-tenant-slug": tenantSlugSchema.optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type TenantSlug = z.infer<typeof tenantSlugSchema>;
