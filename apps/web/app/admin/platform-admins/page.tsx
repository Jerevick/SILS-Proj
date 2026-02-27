"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Button,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { AdminShell } from "../components/admin-shell";
import {
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES_ORDERED,
  type PlatformRole,
} from "@/lib/platform-roles";

type PlatformAdminRow = {
  id: string;
  clerkUserId: string;
  email: string | null;
  role: PlatformRole;
  status: string;
  createdAt: string;
};

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "#0f172a" },
  },
});

async function fetchPlatformAdmins(): Promise<PlatformAdminRow[]> {
  const res = await fetch("/api/admin/platform-admins");
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only Platform Owners can manage staff.");
    throw new Error("Failed to fetch platform staff");
  }
  return res.json();
}

async function addPlatformStaff(email: string, role: PlatformRole) {
  const res = await fetch("/api/admin/platform-admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to add");
}

async function updatePlatformStaff(
  id: string,
  updates: { role?: PlatformRole; status?: string }
) {
  const res = await fetch(`/api/admin/platform-admins/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to update");
}

async function removePlatformStaff(id: string) {
  const res = await fetch(`/api/admin/platform-admins/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to remove");
  }
}

export default function AdminPlatformAdminsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<PlatformRole>("PLATFORM_ADMIN");
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: fetchPlatformAdmins,
  });

  const addMutation = useMutation({
    mutationFn: () => addPlatformStaff(email.trim(), newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      setEmail("");
      toast.success("Staff added", {
        description: "Platform staff member has been added. They will receive an email with login details if they are new.",
      });
    },
    onError: (err) => toast.error("Failed to add staff", { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { role?: PlatformRole; status?: string };
    }) => updatePlatformStaff(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Updated", { description: "Platform staff role or status has been updated." });
    },
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });

  const removeMutation = useMutation({
    mutationFn: removePlatformStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Staff removed", { description: "Platform staff member has been removed." });
    },
    onError: (err) => toast.error("Remove failed", { description: err.message }),
  });

  const columns: GridColDef<PlatformAdminRow>[] = [
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    {
      field: "role",
      headerName: "Role",
      width: 180,
      valueFormatter: (_, row) => PLATFORM_ROLE_LABELS[row.role],
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value}
          color={params.value === "ACTIVE" ? "success" : "default"}
          variant="outlined"
        />
      ),
    },
    {
      field: "createdAt",
      headerName: "Added",
      width: 100,
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
      width: 320,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row;
        const busy =
          updateMutation.isPending || removeMutation.isPending;
        return (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={row.role}
                onChange={(e) =>
                  updateMutation.mutate({
                    id: row.id,
                    updates: { role: e.target.value as PlatformRole },
                  })
                }
                disabled={busy}
                sx={{
                  color: "rgba(226,232,240,0.9)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                }}
              >
                {PLATFORM_ROLES_ORDERED.map((r) => (
                  <MenuItem key={r} value={r}>
                    {PLATFORM_ROLE_LABELS[r]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                updateMutation.mutate({
                  id: row.id,
                  updates: {
                    status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                  },
                })
              }
              disabled={busy}
            >
              {row.status === "ACTIVE" ? "Suspend" : "Activate"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => removeMutation.mutate(row.id)}
              disabled={busy}
            >
              Remove
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <AdminShell activeNav="platform-admins">
      <Typography variant="h5" sx={{ color: "white", mb: 1 }}>
        Platform staff
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.7)", mb: 3 }}>
        Add, remove, suspend, or change roles for users who can access the
        platform admin area. Only Platform Owners can see this page. Env-based
        admins (SUPER_ADMIN_EMAILS / SUPER_ADMIN_CLERK_USER_IDS) are not listed
        but have full owner access.
      </Typography>

      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addMutation.mutate();
            }}
            sx={{
              width: 260,
              "& .MuiOutlinedInput-root": {
                color: "rgba(226,232,240,0.9)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="new-role-label" sx={{ color: "rgba(226,232,240,0.7)" }}>
              Role
            </InputLabel>
            <Select
              labelId="new-role-label"
              label="Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as PlatformRole)}
              sx={{
                color: "rgba(226,232,240,0.9)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.2)",
                },
              }}
            >
              {PLATFORM_ROLES_ORDERED.map((r) => (
                <MenuItem key={r} value={r}>
                  {PLATFORM_ROLE_LABELS[r]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => addMutation.mutate()}
            disabled={!email.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? "Adding…" : "Add staff"}
          </Button>
        </Box>

        <Box
          sx={{
            minHeight: 400,
            height: 440,
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
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            slots={{
              noRowsOverlay: () =>
                error ? (
                  <Typography color="error">
                    {String((error as Error).message)}
                  </Typography>
                ) : (
                  <Typography color="text.secondary">
                    No platform staff in database. Add by email above or use env
                    vars.
                  </Typography>
                ),
            }}
          />
        </Box>
      </ThemeProvider>
    </AdminShell>
  );
}
