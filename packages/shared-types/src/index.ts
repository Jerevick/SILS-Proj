/**
 * @sils/shared-types
 * Shared TypeScript types and enums for SILS monorepo.
 */

// ----- Multi-tenancy & auth -----
export type TenantId = string;

export enum UserRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  INSTRUCTOR = "INSTRUCTOR",
  LEARNER = "LEARNER",
  SUPPORT = "SUPPORT",
}

export interface TenantContext {
  tenantId: TenantId;
  role: UserRole;
  featureFlags: FeatureFlags;
  deploymentMode: DeploymentMode;
}

// ----- Feature flags (per-tenant) -----
export interface FeatureFlags {
  /** Enable unified SIS (Student Information System) */
  sisEnabled: boolean;
  /** Enable skills graph and vector search */
  skillsGraphEnabled: boolean;
  /** Enable offline/PWA */
  pwaEnabled: boolean;
  /** Enable low-bandwidth mode */
  lowBandwidthEnabled: boolean;
}

// ----- Deployment mode -----
export enum DeploymentMode {
  CLOUD = "CLOUD",
  SELF_HOSTED = "SELF_HOSTED",
  HYBRID = "HYBRID",
}

// ----- Course / module (minimal for shared usage) -----
export type CourseId = string;
export type ModuleId = string;

export interface CourseSummary {
  id: CourseId;
  title: string;
  slug: string;
  tenantId: TenantId;
}

export interface ModuleSummary {
  id: ModuleId;
  courseId: CourseId;
  title: string;
  orderIndex: number;
}

// ----- Skills graph (shared types) -----
export type SkillNodeId = string;

export interface SkillNodeSummary {
  id: SkillNodeId;
  tenantId: TenantId;
  name: string;
  description?: string | null;
}

// ----- Zod schemas (re-export) -----
export {
  healthResponseSchema,
  tenantSlugSchema,
  tenantHeaderSchema,
  type HealthResponse,
  type TenantSlug,
} from "./schemas";
