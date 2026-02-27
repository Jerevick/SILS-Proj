/**
 * TanStack Query hook for current user / tenant context.
 * Used for role-based nav and "Go to LMS" visibility.
 */

import { useQuery } from "@tanstack/react-query";
import type { MeResponse } from "@/app/api/me/route";

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/me");
  if (!res.ok) throw new Error("Failed to fetch me");
  return res.json();
}

export const ME_QUERY_KEY = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

/** Whether the current context is hybrid package (show "Go to LMS" on faculty/student). */
export function isHybridPackage(me: MeResponse | undefined): boolean {
  return me?.kind === "tenant" && me.package === "hybrid";
}

/** Whether SIS dashboards are available (full_sis or hybrid). */
export function isSisAvailable(me: MeResponse | undefined): boolean {
  if (!me || me.kind !== "tenant") return false;
  return me.package === "full_sis" || me.package === "hybrid";
}

/** Staff roles that see SIS nav. */
export function isStaffRole(role: string | null | undefined): boolean {
  return (
    role === "OWNER" || role === "ADMIN" || role === "SUPPORT"
  );
}
