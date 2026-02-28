"use client";

/**
 * Financial Aid dashboard — applications list with AI recommendation column.
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DollarSign, Sparkles, ArrowRight } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { processFinancialAid } from "@/app/actions/finance-actions";
import { useMe } from "@/hooks/use-me";
import { canAccessFinance, canProcessAid } from "@/lib/finance-auth";

type ApplicationRow = {
  id: string;
  studentId: string;
  programmeName: string;
  programmeCode: string;
  requestedAmount: number;
  status: string;
  submittedAt: string | null;
  awardedAmount: number | null;
  aiRecommendation: { recommendation?: string; suggestedAmount?: number; confidence?: number; factors?: string[] } | null;
  createdAt: string;
};

async function fetchApplications(): Promise<ApplicationRow[]> {
  const res = await fetch("/api/finance/aid");
  if (!res.ok) throw new Error("Failed to fetch applications");
  const data = await res.json();
  return data.applications ?? [];
}

export default function FinanceAidPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["finance", "aid"],
    queryFn: fetchApplications,
  });

  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const canProcess = me?.kind === "tenant" && canProcessAid(me.role);
  const canAccess = me?.kind === "tenant" && canAccessFinance(me.role);

  const handleRunAI = async (applicationId: string) => {
    if (!canProcess) return;
    setProcessingId(applicationId);
    try {
      const result = await processFinancialAid(applicationId);
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid"] });
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid", applicationId] });
        router.refresh();
      } else {
        console.error(result.error);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const columns: GridColDef<ApplicationRow>[] = [
    {
      field: "studentId",
      headerName: "Student ID",
      width: 140,
      renderCell: (params) => (
        <Link
          href={`/finance/aid/${params.row.id}`}
          className="text-neon-cyan hover:underline font-medium"
        >
          {params.value}
        </Link>
      ),
    },
    { field: "programmeName", headerName: "Programme", flex: 1, minWidth: 160 },
    { field: "programmeCode", headerName: "Code", width: 100 },
    {
      field: "requestedAmount",
      headerName: "Requested",
      width: 110,
      valueFormatter: (v) => (v != null ? `$${Number(v).toFixed(2)}` : "—"),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
    },
    {
      field: "aiRecommendation",
      headerName: "AI recommendation",
      flex: 1,
      minWidth: 180,
      renderCell: (params) => {
        const rec = params.value as ApplicationRow["aiRecommendation"];
        if (!rec) {
          return canProcess ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRunAI(params.row.id);
              }}
              disabled={processingId === params.row.id}
              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              {processingId === params.row.id ? "Processing…" : "Run AI"}
            </button>
          ) : (
            <span className="text-slate-500">—</span>
          );
        }
        const label =
          rec.recommendation === "approve_full"
            ? "Approve full"
            : rec.recommendation === "approve_partial"
              ? `Partial $${rec.suggestedAmount ?? 0}`
              : "Reject";
        return (
          <span className="text-slate-200">
            {label}
            {typeof rec.confidence === "number" && (
              <span className="text-slate-500 text-xs ml-1">({(rec.confidence * 100).toFixed(0)}%)</span>
            )}
          </span>
        );
      },
    },
    {
      field: "actions",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Link
          href={`/finance/aid/${params.row.id}`}
          className="text-neon-cyan hover:text-neon-cyan/80 inline-flex items-center gap-1 text-sm"
        >
          Review <ArrowRight className="w-4 h-4" />
        </Link>
      ),
    },
  ];

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view financial aid.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-6 h-6 text-amber-400" />
        <h1 className="font-display text-xl font-semibold text-white">
          Financial Aid Applications
        </h1>
      </div>
      <p className="text-slate-400 mb-6">
        Review applications and use AI to get recommendation and draft decision letter. Approve or reject from the detail page.
      </p>
      <DashboardDataGrid<ApplicationRow>
        columns={columns}
        rows={applications}
        getRowId={(row) => row.id}
        pageSize={10}
        title={undefined}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading applications…</p>
      )}
    </div>
  );
}
