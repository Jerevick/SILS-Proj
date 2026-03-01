"use client";

/**
 * Phase 24: Faculty directory — HR & Faculty Workload Management.
 * Lists faculty with workload overview (scoped by HR Admin, Dean, HoD).
 * Uses TanStack Query and MUI DataGrid with link to detailed workload dashboard.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Filter, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import {
  listFacultyProfiles,
  getHRFilterOptions,
  type FacultyProfileListItem,
  type ListFacultyFilters,
} from "@/app/actions/hr-faculty-actions";

type Row = FacultyProfileListItem & { id: string };

function displayName(u: FacultyProfileListItem["user"]) {
  const first = u.firstName ?? "";
  const last = u.lastName ?? "";
  if (first || last) return `${first} ${last}`.trim();
  return u.email ?? "—";
}

export default function HrFacultyPage() {
  const [schoolId, setSchoolId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [termId, setTermId] = useState<string>("");

  const filters: ListFacultyFilters = useMemo(() => {
    const f: ListFacultyFilters = {};
    if (schoolId) f.schoolId = schoolId;
    if (departmentId) f.departmentId = departmentId;
    if (termId) f.termId = termId;
    return f;
  }, [schoolId, departmentId, termId]);

  const { data: options } = useQuery({
    queryKey: ["hr-filter-options"],
    queryFn: async () => {
      const r = await getHRFilterOptions();
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["hr-faculty", filters],
    queryFn: async () => {
      const r = await listFacultyProfiles(Object.keys(filters).length ? filters : undefined);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const faculty = data?.faculty ?? [];
  const rows: Row[] = faculty.map((f) => ({ ...f, id: f.id }));

  const columns: GridColDef<Row>[] = [
    {
      field: "user",
      headerName: "Name",
      flex: 1,
      minWidth: 180,
      valueGetter: (_, row) => displayName(row.user),
      renderCell: (params) => (
        <Link
          href={`/hr/workload/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {displayName(params.row.user)}
        </Link>
      ),
    },
    {
      field: "employeeId",
      headerName: "Employee ID",
      width: 120,
    },
    {
      field: "department",
      headerName: "Department",
      width: 160,
      valueGetter: (_, row) => row.department?.name ?? "—",
    },
    {
      field: "school",
      headerName: "School",
      width: 140,
      valueGetter: (_, row) => row.school?.name ?? "—",
    },
    {
      field: "employmentStatus",
      headerName: "Status",
      width: 110,
      valueFormatter: (v) => (v ? String(v).replace(/_/g, " ") : ""),
    },
    {
      field: "maxWorkloadHours",
      headerName: "Max hrs",
      width: 90,
      type: "number",
    },
    {
      field: "totalHoursThisTerm",
      headerName: "Hours (term)",
      width: 110,
      type: "number",
      renderCell: (params) => {
        const total = params.value as number | undefined;
        const max = params.row.maxWorkloadHours;
        const over = typeof total === "number" && max > 0 && total > max;
        return (
          <span className={over ? "text-amber-400 font-medium" : ""}>
            {typeof total === "number" ? total : "—"}
            {over && <AlertTriangle className="inline h-4 w-4 ml-1 text-amber-400" />}
          </span>
        );
      },
    },
    {
      field: "actions",
      headerName: "Workload",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Link href={`/hr/workload/${params.row.id}`}>
          <Button variant="outline" size="sm" className="border-neon-cyan/40 text-neon-cyan">
            <BarChart3 className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Users className="h-7 w-7 text-neon-cyan" />
          Faculty Directory
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          View faculty and workload overview. Use filters to scope by school, department, or term.
        </p>
      </div>

      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-neon-cyan" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={termId || "all"} onValueChange={(v) => setTermId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {options?.terms?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolId || "all"} onValueChange={(v) => setSchoolId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {options?.schools?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={departmentId || "all"}
            onValueChange={(v) => setDepartmentId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {options?.departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white">Faculty list</CardTitle>
          <p className="text-slate-400 text-sm">
            {termId ? "Workload hours shown for selected term." : "Select a term to see workload hours for the term."}
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-amber-400 text-sm py-4">{(error as Error).message}</p>
          )}
          {isLoading && (
            <p className="text-slate-400 py-8">Loading faculty…</p>
          )}
          {!isLoading && !error && faculty.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No faculty profiles found. Add faculty profiles to get started.</p>
            </div>
          )}
          {!isLoading && !error && faculty.length > 0 && (
            <DashboardDataGrid<Row>
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
