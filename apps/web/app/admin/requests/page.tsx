"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Button,
  Chip,
  Box,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

type OnboardingRequestRow = {
  id: string;
  deploymentMode: string;
  institutionName: string;
  slug: string;
  contactPerson: string;
  contactEmail: string;
  phone: string | null;
  country: string;
  website: string | null;
  approxStudents: number | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  tenantId: string | null;
  tenant: { id: string; slug: string; name: string } | null;
};

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "#0f172a" },
  },
});

async function fetchRequests(): Promise<OnboardingRequestRow[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

async function approveRequest(id: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to approve");
  }
}

async function rejectRequest(id: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to reject");
  }
}

export default function AdminRequestsPage() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: fetchRequests,
  });

  const approveMutation = useMutation({
    mutationFn: approveRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: rejectRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] }),
  });

  const columns: GridColDef<OnboardingRequestRow>[] = [
    { field: "institutionName", headerName: "Institution", flex: 1, minWidth: 160 },
    { field: "slug", headerName: "Slug", width: 140 },
    {
      field: "deploymentMode",
      headerName: "Mode",
      width: 140,
      valueFormatter: (v) =>
        v === "LMS_ONLY" ? "LMS-Only" : v === "HYBRID_BRIDGE" ? "Hybrid Bridge" : "Unified Blended",
    },
    { field: "contactPerson", headerName: "Contact", width: 130 },
    { field: "contactEmail", headerName: "Email", flex: 1, minWidth: 180 },
    { field: "country", headerName: "Country", width: 110 },
    {
      field: "approxStudents",
      headerName: "Students",
      width: 95,
      type: "number",
      valueGetter: (_, row) => row.approxStudents ?? "",
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
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
        />
      ),
    },
    {
      field: "createdAt",
      headerName: "Submitted",
      width: 110,
      type: "dateTime",
      valueFormatter: (_, row) =>
        new Date(row.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        if (params.row.status !== "PENDING") return null;
        const id = params.row.id;
        return (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => approveMutation.mutate(id)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => rejectMutation.mutate(id)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              Reject
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-white">
            SILS Super Admin
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/admin/dashboard"
              className="text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/requests"
              className="text-sm font-medium text-neon-cyan"
            >
              Onboarding requests
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <Typography variant="h5" sx={{ color: "white", mb: 2 }}>
          Onboarding requests
        </Typography>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <Box
            sx={{
              height: 520,
              width: "100%",
              "& .MuiDataGrid-root": { border: "1px solid rgba(255,255,255,0.1)" },
              "& .MuiDataGrid-cell": { color: "rgba(226,232,240,0.9)" },
              "& .MuiDataGrid-columnHeaders": { backgroundColor: "rgba(15,23,42,0.95)" },
              "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(0,245,255,0.06)" },
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              loading={isLoading}
              getRowId={(row) => row.id}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
              slots={{
                noRowsOverlay: () =>
                  error ? (
                    <Typography color="error">
                      {String((error as Error).message)}
                    </Typography>
                  ) : (
                    <Typography color="text.secondary">
                      No onboarding requests
                    </Typography>
                  ),
              }}
            />
          </Box>
        </ThemeProvider>
      </main>
    </div>
  );
}
