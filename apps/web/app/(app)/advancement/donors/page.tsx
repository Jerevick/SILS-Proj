"use client";

/**
 * Donor directory — lifetime value, affinity score, last interaction.
 * Uses TanStack Query and MUI DataGrid. Scoped: Advancement Officer, Development Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMe } from "@/hooks/use-me";
import { canAccessAdvancement } from "@/lib/advancement-auth";

type DonorRow = {
  id: string;
  name: string;
  email: string;
  lifetimeValue: number;
  affinityScore: number;
  lastContactDate: string | null;
  lastDonationDate: string | null;
  lastInteractionDate: string | null;
  tags: string[];
  createdAt: string;
};

async function fetchDonors(): Promise<DonorRow[]> {
  const res = await fetch("/api/advancement/donors");
  if (!res.ok) throw new Error("Failed to fetch donors");
  const data = await res.json();
  return data.donors ?? [];
}

export default function AdvancementDonorsPage() {
  const { data: donors = [], isLoading } = useQuery({
    queryKey: ["advancement", "donors"],
    queryFn: fetchDonors,
  });
  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAdvancement(me.role);

  const columns: GridColDef<DonorRow>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Link
          href={`/advancement/donors/${params.row.id}`}
          className="text-neon-cyan hover:underline font-medium"
        >
          {params.value}
        </Link>
      ),
    },
    { field: "email", headerName: "Email", flex: 1, minWidth: 180 },
    {
      field: "lifetimeValue",
      headerName: "Lifetime value",
      width: 130,
      valueFormatter: (v) => (v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"),
    },
    {
      field: "affinityScore",
      headerName: "Affinity",
      width: 90,
      valueFormatter: (v) => (v != null ? Number(v).toFixed(1) : "—"),
    },
    {
      field: "lastContactDate",
      headerName: "Last contact",
      width: 120,
      valueFormatter: (v) => v ?? "—",
    },
    {
      field: "lastInteractionDate",
      headerName: "Last interaction",
      width: 120,
      valueFormatter: (v) => v ?? "—",
    },
    {
      field: "tags",
      headerName: "Tags",
      width: 140,
      valueFormatter: (v) => (Array.isArray(v) && v.length ? v.join(", ") : "—"),
    },
    {
      field: "actions",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Link
          href={`/advancement/donors/${params.row.id}`}
          className="text-neon-cyan hover:text-neon-cyan/80 inline-flex items-center gap-1 text-sm"
        >
          View <ArrowRight className="w-4 h-4" />
        </Link>
      ),
    },
  ];

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view the donor directory.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-cyan-400" />
        <h1 className="font-display text-xl font-semibold text-white">
          Donor Directory
        </h1>
      </div>
      <p className="text-slate-400 mb-6">
        View donors by lifetime value and affinity. Open a donor to see interaction history and generate personalized outreach.
      </p>
      <DashboardDataGrid<DonorRow>
        columns={columns}
        rows={donors}
        getRowId={(row) => row.id}
        pageSize={10}
        title={undefined}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading donors…</p>
      )}
    </div>
  );
}
