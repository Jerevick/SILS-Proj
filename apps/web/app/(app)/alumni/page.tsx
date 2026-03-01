"use client";

/**
 * Phase 26: Alumni directory — search and filters with MUI DataGrid.
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users, ArrowRight, Search, Calendar } from "lucide-react";
import type { GridColDef } from "@mui/x-data-grid";
import { useMe } from "@/hooks/use-me";
import { canAccessAlumni } from "@/lib/alumni-career-auth";

type AlumniRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  graduationYear: number;
  degree: string;
  currentEmployer: string | null;
  currentRole: string | null;
  linkedinUrl: string | null;
  createdAt: string;
};

async function fetchAlumni(params: { graduationYear?: string; degree?: string; q?: string }): Promise<AlumniRow[]> {
  const sp = new URLSearchParams();
  if (params.graduationYear) sp.set("graduationYear", params.graduationYear);
  if (params.degree) sp.set("degree", params.degree);
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/alumni?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch alumni");
  const data = await res.json();
  return data.alumni ?? [];
}

export default function AlumniDirectoryPage() {
  const [filters, setFilters] = React.useState<{ graduationYear: string; degree: string; q: string }>({
    graduationYear: "",
    degree: "",
    q: "",
  });

  const { data: alumni = [], isLoading } = useQuery({
    queryKey: ["alumni", filters.graduationYear, filters.degree, filters.q],
    queryFn: () =>
      fetchAlumni({
        graduationYear: filters.graduationYear || undefined,
        degree: filters.degree || undefined,
        q: filters.q || undefined,
      }),
  });

  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAlumni(me.role);

  const columns: GridColDef<AlumniRow>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Link
          href={`/alumni/${params.row.id}`}
          className="text-neon-cyan hover:underline font-medium"
        >
          {params.value}
        </Link>
      ),
    },
    { field: "email", headerName: "Email", flex: 1, minWidth: 180, valueFormatter: (v) => v ?? "—" },
    {
      field: "graduationYear",
      headerName: "Graduation",
      width: 110,
    },
    {
      field: "degree",
      headerName: "Degree",
      flex: 1,
      minWidth: 140,
    },
    {
      field: "currentRole",
      headerName: "Current role",
      flex: 1,
      minWidth: 140,
      valueFormatter: (v) => v ?? "—",
    },
    {
      field: "currentEmployer",
      headerName: "Employer",
      flex: 1,
      minWidth: 140,
      valueFormatter: (v) => v ?? "—",
    },
    {
      field: "actions",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Link
          href={`/alumni/${params.row.id}`}
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
        <p className="text-slate-400">You do not have permission to view the alumni directory.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-cyan-400" />
        <h1 className="font-display text-xl font-semibold text-white">
          Alumni Directory
        </h1>
      </div>
      <p className="text-slate-400 mb-4">
        Browse alumni by graduation year, degree, and role. Connect with mentors and explore career paths.{" "}
        <Link href="/alumni/events" className="text-neon-cyan hover:underline inline-flex items-center gap-1">
          <Calendar className="w-4 h-4" /> Events & networking
        </Link>
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, role, employer…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="pl-9 pr-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500 w-64"
          />
        </div>
        <input
          type="number"
          placeholder="Graduation year"
          min={1990}
          max={2030}
          value={filters.graduationYear}
          onChange={(e) => setFilters((f) => ({ ...f, graduationYear: e.target.value }))}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500 w-36"
        />
        <input
          type="text"
          placeholder="Degree"
          value={filters.degree}
          onChange={(e) => setFilters((f) => ({ ...f, degree: e.target.value }))}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500 w-48"
        />
      </div>

      <DashboardDataGrid<AlumniRow>
        columns={columns}
        rows={alumni}
        getRowId={(row) => row.id}
        pageSize={10}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading alumni…</p>
      )}
    </div>
  );
}
