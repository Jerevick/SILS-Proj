"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "../components/admin-shell";
import { AdminDataGrid, type GridColDef, type GridRenderCellParams } from "@/components/admin/data-grid";
import { ActionsCell } from "@/components/admin/actions-cell";
import { institutionsResponseSchema, type InstitutionRowSchema } from "@/lib/admin-schemas";
import { ArrowRight, CheckCircle, Pencil } from "lucide-react";

async function fetchInstitutions(): Promise<InstitutionRowSchema[]> {
  const res = await fetch("/api/admin/institutions");
  if (!res.ok) throw new Error("Failed to fetch institutions");
  const data = await res.json();
  return institutionsResponseSchema.parse(data);
}

export default function AdminInstitutionsPage() {
  const router = useRouter();
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: fetchInstitutions,
    retry: 1,
  });

  useEffect(() => {
    if (error && !isLoading)
      toast.error("Failed to load institutions", {
        description: (error as Error).message,
        id: "admin-institutions-error",
      });
  }, [error, isLoading]);

  const columns: GridColDef<InstitutionRowSchema>[] = [
    {
      field: "name",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<InstitutionRowSchema>) => (
        <Link
          href={`/admin/institutions/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.name}
        </Link>
      ),
    },
    { field: "slug", headerName: "Slug", width: 140 },
    {
      field: "deploymentMode",
      headerName: "Mode",
      width: 120,
      valueFormatter: (v: string) =>
        v === "SIS" ? "SIS" : v === "LMS" ? "LMS" : "Hybrid (SIS+LMS)",
    },
    {
      field: "users",
      headerName: "Users",
      width: 90,
      valueGetter: (_: unknown, row: InstitutionRowSchema) => row._count?.users ?? 0,
    },
    {
      field: "courses",
      headerName: "Courses",
      width: 90,
      valueGetter: (_: unknown, row: InstitutionRowSchema) => row._count?.courses ?? 0,
    },
    {
      field: "paymentVerifiedAt",
      headerName: "Payment",
      width: 100,
      renderCell: (params: GridRenderCellParams<InstitutionRowSchema>) =>
        params.value ? (
          <span className="flex items-center gap-1 text-emerald-400" title={new Date(params.value as string).toLocaleString()}>
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">Paid</span>
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        ),
    },
    {
      field: "onboardingRequest",
      headerName: "Contact",
      width: 180,
      valueGetter: (_: unknown, row: InstitutionRowSchema) =>
        row.onboardingRequest?.contactEmail ?? "—",
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 110,
      type: "dateTime",
      valueFormatter: (_: unknown, row: InstitutionRowSchema) =>
        new Date(row.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 72,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<InstitutionRowSchema>) => {
        const row = params.row;
        const href = `/admin/institutions/${row.id}`;
        const actions = [
          {
            label: "Edit",
            icon: Pencil,
            onClick: () => router.push(href),
          },
          {
            label: "Manage",
            icon: ArrowRight,
            onClick: () => router.push(href),
          },
        ];
        return <ActionsCell row={row} actions={actions} />;
      },
    },
  ];

  return (
    <AdminShell activeNav="institutions">
      <h1 className="text-xl font-semibold text-white mb-1">
        All institutions
      </h1>
      <p className="text-slate-400 text-sm mb-3">
        Tenants (institutions) that have been onboarded. Pending requests are in
        Onboarding requests.
      </p>
      <AdminDataGrid<InstitutionRowSchema>
        rows={rows}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.id}
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        disableRowSelectionOnClick
        height={520}
        slots={{
          noRowsOverlay: () =>
            error ? (
              <p className="text-red-400 p-4">{String((error as Error).message)}</p>
            ) : (
              <p className="text-slate-400 p-4">No institutions yet</p>
            ),
        }}
      />
    </AdminShell>
  );
}
