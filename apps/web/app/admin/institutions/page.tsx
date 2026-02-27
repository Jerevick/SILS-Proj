"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { AdminShell } from "../components/admin-shell";

type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  clerkOrgId: string;
  deploymentMode: string;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; courses: number };
  onboardingRequest: {
    id: string;
    institutionName: string;
    contactEmail: string;
    status: string;
  } | null;
};

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "#0f172a" },
  },
});

async function fetchInstitutions(): Promise<InstitutionRow[]> {
  const res = await fetch("/api/admin/institutions");
  if (!res.ok) throw new Error("Failed to fetch institutions");
  return res.json();
}

export default function AdminInstitutionsPage() {
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

  const columns: GridColDef<InstitutionRow>[] = [
    { field: "name", headerName: "Institution", flex: 1, minWidth: 180 },
    { field: "slug", headerName: "Slug", width: 140 },
    {
      field: "deploymentMode",
      headerName: "Mode",
      width: 120,
      valueFormatter: (v) =>
        v === "CLOUD"
          ? "Cloud"
          : v === "HYBRID"
            ? "Hybrid"
            : "Self-hosted",
    },
    {
      field: "users",
      headerName: "Users",
      width: 90,
      valueGetter: (_, row) => row._count.users,
    },
    {
      field: "courses",
      headerName: "Courses",
      width: 90,
      valueGetter: (_, row) => row._count.courses,
    },
    {
      field: "onboardingRequest",
      headerName: "Contact",
      width: 180,
      valueGetter: (_, row) =>
        row.onboardingRequest?.contactEmail ?? "—",
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 110,
      type: "dateTime",
      valueFormatter: (_, row) =>
        new Date(row.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
  ];

  return (
    <AdminShell activeNav="institutions">
      <Typography variant="h5" sx={{ color: "white", mb: 2 }}>
        All institutions
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.7)", mb: 3 }}>
        Tenants (institutions) that have been onboarded. Pending requests are in
        Onboarding requests.
      </Typography>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: 400,
            height: 520,
            width: "100%",
            "& .MuiDataGrid-root": { border: "1px solid rgba(255,255,255,0.1)" },
            "& .MuiDataGrid-cell": { color: "rgba(226,232,240,0.9)" },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "rgba(15,23,42,0.95)",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "rgba(0,245,255,0.06)",
            },
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
                    No institutions yet
                  </Typography>
                ),
            }}
          />
        </Box>
      </ThemeProvider>
    </AdminShell>
  );
}
