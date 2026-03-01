"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Chip,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { CheckCircle, Ban, OpenInNew } from "lucide-react";
import { AdminShell } from "../components/admin-shell";
import {
  AdminDataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from "@/components/admin/data-grid";
import {
  onboardingRequestsResponseSchema,
  type OnboardingRequestRowSchema,
} from "@/lib/admin-schemas";

const DEPLOYMENT_LABELS: Record<string, string> = {
  LMS: "LMS-Only",
  HYBRID: "Hybrid Bridge",
  SIS: "Unified Blended",
};

async function fetchRequests(): Promise<OnboardingRequestRowSchema[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  const data = await res.json();
  return onboardingRequestsResponseSchema.parse(data);
}

async function approveRequest(id: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Approve failed");
  }
  return res.json();
}

async function rejectRequest(id: string, reason: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Reject failed");
  }
  return res.json();
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AdminRequestsPage() {
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    id: string | null;
    institutionName: string;
    reason: string;
  }>({ open: false, id: null, institutionName: "", reason: "" });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: fetchRequests,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      toast.success("Request approved", {
        description: "Clerk organization and tenant created. Welcome email sent to contact.",
      });
    },
    onError: (err: Error) => {
      toast.error("Approve failed", { description: err.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      setRejectDialog((d) => ({ ...d, open: false, id: null, reason: "" }));
      toast.success("Request rejected", {
        description: "Rejection reason saved. Contact can be notified separately.",
      });
    },
    onError: (err: Error) => {
      toast.error("Reject failed", { description: err.message });
    },
  });

  const openRejectDialog = (row: OnboardingRequestRowSchema) => {
    setRejectDialog({
      open: true,
      id: row.id,
      institutionName: row.institutionName,
      reason: "",
    });
  };

  const submitReject = () => {
    if (!rejectDialog.id || !rejectDialog.reason.trim()) {
      toast.error("Please enter a reason for rejection.");
      return;
    }
    rejectMutation.mutate({ id: rejectDialog.id, reason: rejectDialog.reason.trim() });
  };

  const columns: GridColDef<OnboardingRequestRowSchema>[] = [
    {
      field: "institutionName",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRowSchema>) => (
        <Link
          href={`/admin/requests/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline flex items-center gap-1"
        >
          {params.row.institutionName}
          <OpenInNew className="h-3.5 w-3.5 opacity-70" />
        </Link>
      ),
    },
    {
      field: "slug",
      headerName: "Slug",
      width: 130,
      valueGetter: (_, row) => row.slug,
    },
    {
      field: "deploymentMode",
      headerName: "Mode",
      width: 130,
      valueGetter: (_, row) => DEPLOYMENT_LABELS[row.deploymentMode] ?? row.deploymentMode,
    },
    {
      field: "contactPerson",
      headerName: "Contact",
      width: 140,
      valueGetter: (_, row) => row.contactPerson,
    },
    {
      field: "contactEmail",
      headerName: "Email",
      width: 180,
      valueGetter: (_, row) => row.contactEmail,
    },
    {
      field: "createdAt",
      headerName: "Submitted",
      width: 110,
      valueGetter: (_, row) => formatDate(row.createdAt),
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
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRowSchema>) => {
        if (params.row.status !== "PENDING") {
          return (
            <span className="text-slate-500 text-sm">
              {params.row.status === "APPROVED" ? "Approved" : "Rejected"}
            </span>
          );
        }
        return (
          <div className="flex items-center gap-1">
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<CheckCircle className="h-4 w-4" />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                approveMutation.mutate({ id: params.row.id });
              }}
              disabled={approveMutation.isPending}
              sx={{
                borderColor: "rgba(34,197,94,0.5)",
                color: "#4ade80",
                "&:hover": { borderColor: "#4ade80", bgcolor: "rgba(34,197,94,0.1)" },
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Ban className="h-4 w-4" />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openRejectDialog(params.row);
              }}
              disabled={rejectMutation.isPending}
              sx={{
                borderColor: "rgba(239,68,68,0.5)",
                color: "#f87171",
                "&:hover": { borderColor: "#f87171", bgcolor: "rgba(239,68,68,0.1)" },
              }}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AdminShell activeNav="requests">
      <Typography variant="h5" sx={{ color: "white", mb: 2 }}>
        Onboarding requests
      </Typography>
      <Typography variant="body2" sx={{ color: "rgba(226,232,240,0.7)", mb: 3 }}>
        Review pending requests, approve to create Clerk Organization and tenant and send welcome email, or reject with a reason.
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

      <Dialog
        open={rejectDialog.open}
        onClose={() => !rejectMutation.isPending && setRejectDialog((d) => ({ ...d, open: false, reason: "" }))}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "rgb(15 23 42)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0",
          },
        }}
      >
        <DialogTitle>Reject onboarding request</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "rgba(226,232,240,0.8)", mb: 2 }}>
            Rejecting request for <strong>{rejectDialog.institutionName}</strong>. A reason is required and will be stored with the request.
          </Typography>
          <TextField
            label="Reason for rejection"
            placeholder="e.g. Incomplete information, outside our current focus region..."
            multiline
            rows={3}
            required
            fullWidth
            value={rejectDialog.reason}
            onChange={(e) =>
              setRejectDialog((d) => ({ ...d, reason: e.target.value }))
            }
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#e2e8f0",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              },
              "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setRejectDialog((d) => ({ ...d, open: false, reason: "" }))}
            disabled={rejectMutation.isPending}
            sx={{ color: "rgba(226,232,240,0.8)" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={submitReject}
            disabled={!rejectDialog.reason.trim() || rejectMutation.isPending}
          >
            {rejectMutation.isPending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminShell>
  );
}
