/**
 * TanStack Query hook for dashboard stats by context.
 */

import { useQuery } from "@tanstack/react-query";
import type {
  DashboardContext,
  DashboardStatsResponse,
} from "@/app/api/dashboard/stats/route";

async function fetchDashboardStats(
  context: DashboardContext
): Promise<DashboardStatsResponse> {
  const res = await fetch(`/api/dashboard/stats?context=${context}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export const DASHBOARD_STATS_QUERY_KEY = ["dashboard-stats"] as const;

export function useDashboardStats(context: DashboardContext) {
  return useQuery({
    queryKey: [...DASHBOARD_STATS_QUERY_KEY, context],
    queryFn: () => fetchDashboardStats(context),
    staleTime: 2 * 60 * 1000,
  });
}
