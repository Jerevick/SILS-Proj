"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Chip, Typography } from "@mui/material";
import { AdminShell } from "../components/admin-shell";
import { AdminDataGrid, type GridColDef, type GridRenderCellParams } from "@/components/admin/data-grid";
import { onboardingRequestsResponseSchema, type OnboardingRequestRowSchema } from "@/lib/admin-schemas";

async function fetchRequests(): Promise<OnboardingRequestRowSchema[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  const data = await res.json();
  return onboardingRequestsResponseSchema.parse(data);
}

export default function AdminRequestsPage() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: fetchRequests,
  });

  const columns: GridColDef<OnboardingRequestRowSchema>[] = [
    {
      field: "institutionName",
      headerName: "Institution",
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRowSchema>) => (
        <Link
          href={`/admin/requests/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.institutionName}
        </Link>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRowSchema>) => (
        <Chip
          size="small"
          label={params.value}
          color={
            params.value === "APPROVED"
              ? "success"
              : params.value === "REJECTED"
                ? "error"
                : "default"
          }
          variant="outlined"
          sx={{
            fontWeight: 600,
            borderColor:
              params.value === "APPROVED"
                ? "rgba(34,197,94,0.5)"
                : params.value === "REJECTED"
                  ? "rgba(239,68,68,0.5)"
                  : "rgba(148,163,184,0.4)",
            color:
              params.value === "APPROVED"
                ? "#4ade80"
                : params.value === "REJECTED"
                  ? "#f87171"
                  : "rgba(148,163,184,0.9)",
          }}
        />
      ),
    },
    {
      field: "termsAcceptedAt",
      headerName: "Terms & conditions",
      width: 150,
      valueGetter: (_: unknown, row: OnboardingRequestRowSchema) => row.tenant?.termsAcceptedAt ?? null,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRowSchema>) => {
        const value = params.row.tenant?.termsAcceptedAt;
        if (!params.row.tenant) {
          return <span className="text-slate-500">—</span>;
        }
        if (value) {
          return <span className="text-emerald-400">Accepted</span>;
        }
        return <span className="text-amber-400">Not accepted</span>;
      },
    },
  ];

  return (
    <AdminShell activeNav="requests">
      <Typography variant="h5" sx={{ color: "white", mb: 2 }}>
        Onboarding requests
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.7)", mb: 3 }}>
        Click an institution to open its request and see full details, contact info, and approve or reject.
      </Typography>
      <AdminDataGrid<OnboardingRequestRowSchema>
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
              <Typography color="error" sx={{ p: 2 }}>
                {String((error as Error).message)}
              </Typography>
            ) : (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                No onboarding requests
              </Typography>
            ),
        }}
      />
    </AdminShell>
  );
}
