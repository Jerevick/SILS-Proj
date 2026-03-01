"use client";

/**
 * Campaign management — progress tracking and goals.
 * Uses TanStack Query and Recharts for progress. Scoped: Advancement Officer, Development Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMe } from "@/hooks/use-me";
import { canAccessAdvancement } from "@/lib/advancement-auth";

type CampaignRow = {
  id: string;
  name: string;
  schoolId: string | null;
  school: { id: string; name: string; code: string } | null;
  goalAmount: number;
  totalRaised: number;
  progressPct: number;
  startDate: string;
  endDate: string;
  status: string;
  donorCount: number;
  createdAt: string;
};

async function fetchCampaigns(): Promise<CampaignRow[]> {
  const res = await fetch("/api/advancement/campaigns");
  if (!res.ok) throw new Error("Failed to fetch campaigns");
  const data = await res.json();
  return data.campaigns ?? [];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#64748b",
  ACTIVE: "#22c55e",
  ENDED: "#0ea5e9",
  CANCELLED: "#94a3b8",
};

export default function AdvancementCampaignsPage() {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["advancement", "campaigns"],
    queryFn: fetchCampaigns,
  });
  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAdvancement(me.role);

  const chartData = campaigns
    .filter((c) => c.status === "ACTIVE" || c.status === "ENDED")
    .slice(0, 10)
    .map((c) => ({
      name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
      fullName: c.name,
      goal: c.goalAmount,
      raised: c.totalRaised,
      pct: c.progressPct,
    }));

  const columns: GridColDef<CampaignRow>[] = [
    {
      field: "name",
      headerName: "Campaign",
      flex: 1,
      minWidth: 180,
    },
    {
      field: "school",
      headerName: "School",
      width: 140,
      valueGetter: (_, row) => row.school?.name ?? "—",
    },
    {
      field: "goalAmount",
      headerName: "Goal",
      width: 120,
      valueFormatter: (v) => (v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—"),
    },
    {
      field: "totalRaised",
      headerName: "Raised",
      width: 120,
      valueFormatter: (v) => (v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—"),
    },
    {
      field: "progressPct",
      headerName: "Progress",
      width: 100,
      valueFormatter: (v) => (v != null ? `${Number(v).toFixed(0)}%` : "—"),
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${STATUS_COLORS[params.value as string] ?? "#475569"}30`,
            color: STATUS_COLORS[params.value as string] ?? "#94a3b8",
          }}
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "donorCount",
      headerName: "Gifts",
      width: 90,
    },
    {
      field: "endDate",
      headerName: "End date",
      width: 110,
    },
  ];

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view campaigns.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-6 h-6 text-purple-400" />
        <h1 className="font-display text-xl font-semibold text-white">
          Campaigns
        </h1>
      </div>
      <p className="text-slate-400 mb-6">
        Track campaign goals and progress. Active and ended campaigns are shown in the chart below.
      </p>

      {chartData.length > 0 && (
        <div className="rounded-xl glass border border-neon-cyan/20 bg-neon-cyan/5 p-4 mb-8">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            Campaign progress
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                  formatter={(value: number, _name: string, props: { payload: { fullName: string; goal: number; pct: number } }) => [
                    `$${value.toLocaleString("en-US", { minimumFractionDigits: 0 })} / $${props.payload.goal.toLocaleString("en-US", { minimumFractionDigits: 0 })} (${props.payload.pct.toFixed(0)}%)`,
                    "Raised",
                  ]}
                  labelFormatter={(_: string, payload: { payload?: { fullName?: string } }[]) => payload?.[0]?.payload?.fullName ?? ""}
                />
                <Bar dataKey="raised" fill="#00f5ff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <DashboardDataGrid<CampaignRow>
        columns={columns}
        rows={campaigns}
        getRowId={(row) => row.id}
        pageSize={10}
        title={undefined}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading campaigns…</p>
      )}
    </div>
  );
}
