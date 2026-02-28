/**
 * Shared TanStack Query keys for cache invalidation across pages.
 * Keep page modules exporting only Next.js-reserved exports (default, config, etc.).
 */

export const PROGRAMMES_QUERY_KEY = ["programmes"] as const;

// Phase 9: Competency graph & portfolio
export const COMPETENCIES_QUERY_KEY = ["competencies"] as const;
export const competenciesByProgrammeKey = (programmeId: string) =>
  [...COMPETENCIES_QUERY_KEY, "programme", programmeId] as const;
export const PORTFOLIO_QUERY_KEY = ["portfolio"] as const;
export const portfolioByStudentKey = (studentId: string) =>
  [...PORTFOLIO_QUERY_KEY, studentId] as const;
