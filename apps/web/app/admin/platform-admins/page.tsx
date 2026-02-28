"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "../components/admin-shell";
import { AdminDataGrid, type GridColDef, type GridRenderCellParams } from "@/components/admin/data-grid";
import { ActionsCell } from "@/components/admin/actions-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES_ORDERED,
  type PlatformRole,
} from "@/lib/platform-roles";
import { platformAdminsResponseSchema, type PlatformAdminRowSchema } from "@/lib/admin-schemas";
import { UserCog, Ban, CheckCircle, Trash2 } from "lucide-react";

async function fetchPlatformAdmins(): Promise<PlatformAdminRowSchema[]> {
  const res = await fetch("/api/admin/platform-admins");
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only Platform Owners can manage staff.");
    throw new Error("Failed to fetch platform staff");
  }
  const data = await res.json();
  return platformAdminsResponseSchema.parse(data);
}

async function addPlatformStaff(email: string, role: PlatformRole) {
  const res = await fetch("/api/admin/platform-admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to add");
  return data as { emailSent?: boolean; emailError?: string };
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
      setEmail("");
      toast.success("Staff added", {
        description: "Platform staff member has been added. They will receive an email with login details if they are new.",
      });
      if (data && data.emailSent === false && data.emailError) {
        toast.warning("Email not sent", {
          description: data.emailError,
          duration: 8000,
        });
      }
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

  const busy = updateMutation.isPending || removeMutation.isPending;

  const columns: GridColDef<PlatformAdminRowSchema>[] = [
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    {
      field: "role",
      headerName: "Role",
      width: 180,
      valueFormatter: (_, row) => PLATFORM_ROLE_LABELS[row.role as PlatformRole],
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params: GridRenderCellParams<PlatformAdminRowSchema>) => (
        <span
          className={
            params.value === "ACTIVE"
              ? "inline-flex items-center rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400"
              : "inline-flex items-center rounded-md border border-slate-500/50 bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400"
          }
        >
          {String(params.value)}
        </span>
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
      width: 72,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<PlatformAdminRowSchema>) => {
        const row = params.row;
        const role = row.role as PlatformRole;
        const actions = [
          ...PLATFORM_ROLES_ORDERED.map((r) => ({
            label: `Set role to ${PLATFORM_ROLE_LABELS[r]}`,
            icon: UserCog,
            onClick: (rrow: PlatformAdminRowSchema) =>
              updateMutation.mutate({ id: rrow.id, updates: { role: r } }),
            disabled: busy || r === role,
          })),
          {
            label: row.status === "ACTIVE" ? "Suspend" : "Activate",
            icon: row.status === "ACTIVE" ? Ban : CheckCircle,
            onClick: (rrow: PlatformAdminRowSchema) =>
              updateMutation.mutate({
                id: rrow.id,
                updates: { status: rrow.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
              }),
            disabled: busy,
          },
          {
            label: "Remove",
            icon: Trash2,
            onClick: (rrow: PlatformAdminRowSchema) => removeMutation.mutate(rrow.id),
            disabled: busy,
            variant: "destructive" as const,
          },
        ];
        return <ActionsCell row={row} actions={actions} />;
      },
    },
  ];

  return (
    <AdminShell activeNav="platform-admins">
      <h1 className="text-xl font-semibold text-white mb-1">
        Platform staff
      </h1>
      <p className="text-slate-400 text-sm mb-3">
        Add, remove, suspend, or change roles for users who can access the
        platform admin area. Only Platform Owners can see this page. Env-based
        admins (SUPER_ADMIN_EMAILS / SUPER_ADMIN_CLERK_USER_IDS) are not listed
        but have full owner access.
      </p>

      <div className="flex gap-2 items-center mb-2 flex-wrap">
        <div className="space-y-1.5">
          <Input
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addMutation.mutate();
            }}
            className="w-[260px] h-9 border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <Select value={newRole} onValueChange={(v) => setNewRole(v as PlatformRole)}>
          <SelectTrigger className="w-[180px] h-9 border-white/20 bg-transparent text-slate-200">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_ROLES_ORDERED.map((r) => (
              <SelectItem key={r} value={r}>
                {PLATFORM_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!email.trim() || addMutation.isPending}
          className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
        >
          {addMutation.isPending ? "Adding…" : "Add staff"}
        </Button>
      </div>

      <AdminDataGrid<PlatformAdminRowSchema>
        rows={rows}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.id}
        pageSizeOptions={[10, 25]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        disableRowSelectionOnClick
        height={440}
        slots={{
          noRowsOverlay: () =>
            error ? (
              <p className="text-red-400 p-4">{String((error as Error).message)}</p>
            ) : (
              <p className="text-slate-400 p-4">
                No platform staff in database. Add by email above or use env
                vars.
              </p>
            ),
        }}
      />
    </AdminShell>
  );
}
