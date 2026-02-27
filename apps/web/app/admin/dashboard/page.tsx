"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
} from "@mui/x-data-grid";
import {
  Building2,
  Users,
  ClipboardList,
  Cpu,
  Activity,
  MoreHorizontal,
  Eye,
  Pencil,
  RefreshCw,
  Ban,
  CheckCircle,
  Trash2,
  Sparkles,
  Clock,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminShell } from "../components/admin-shell";
import { useMe } from "@/hooks/use-me";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform-roles";
import type { PlatformRole } from "@/lib/platform-roles";

// ----- Types -----
type AdminStats = {
  totalInstitutions: number;
  activeStudents: number;
  pendingOnboardingRequests: number;
  aiAgentsRunning: number;
  systemHealthScore: number;
};

type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  clerkOrgId: string;
  deploymentMode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; courses: number };
  onboardingRequest: {
    id: string;
    institutionName: string;
    contactPerson: string;
    contactEmail: string;
    status: string;
  } | null;
};

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

// ----- API -----
async function fetchStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchInstitutions(): Promise<InstitutionRow[]> {
  const res = await fetch("/api/admin/institutions");
  if (!res.ok) throw new Error("Failed to fetch institutions");
  return res.json();
}

async function fetchOnboardingRequests(): Promise<OnboardingRequestRow[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

async function updateInstitution(
  id: string,
  data: { name?: string; slug?: string; deploymentMode?: string; status?: string }
) {
  const res = await fetch(`/api/admin/institutions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Update failed");
  }
  return res.json();
}

async function deleteInstitution(id: string) {
  const res = await fetch(`/api/admin/institutions/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Delete failed");
  }
}

async function approveOnboardingRequest(id: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Approve failed");
  }
}

async function rejectOnboardingRequest(id: string, _reason?: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Reject failed");
  }
}

// ----- Theme -----
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    secondary: { main: "#a855f7" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
    warning: { main: "#eab308" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.8)" },
  },
  typography: {
    fontFamily: "var(--font-display), system-ui, sans-serif",
  },
});

// ----- Mock data for charts and activity -----
const MOCK_CHART_DATA = [
  { name: "Mon", institutions: 12, students: 420 },
  { name: "Tue", institutions: 14, students: 480 },
  { name: "Wed", institutions: 15, students: 510 },
  { name: "Thu", institutions: 16, students: 545 },
  { name: "Fri", institutions: 18, students: 620 },
  { name: "Sat", institutions: 18, students: 618 },
  { name: "Sun", institutions: 19, students: 640 },
];

const MOCK_ACTIVITY = [
  { id: "1", action: "New onboarding request", target: "Acme University", time: "2 min ago", type: "request" },
  { id: "2", action: "Institution approved", target: "Tech College", time: "1 hour ago", type: "approve" },
  { id: "3", action: "User sign-in", target: "Platform Admin", time: "2 hours ago", type: "auth" },
  { id: "4", action: "Institution updated", target: "Global Ed", time: "5 hours ago", type: "update" },
  { id: "5", action: "New institution created", target: "State School", time: "1 day ago", type: "create" },
];

// ----- Hero metric card -----
function HeroMetricCard({
  icon: Icon,
  value,
  label,
  accent,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  accent?: "cyan" | "purple" | "magenta" | "green";
  delay?: number;
}) {
  const accentClasses =
    accent === "cyan"
      ? "border-neon-cyan/30 bg-neon-cyan/5 shadow-neon-cyan"
      : accent === "purple"
        ? "border-neon-purple/30 bg-neon-purple/5"
        : accent === "magenta"
          ? "border-neon-pink/30 bg-neon-pink/5"
          : accent === "green"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-white/10";
  const iconClasses =
    accent === "cyan"
      ? "text-neon-cyan"
      : accent === "purple"
        ? "text-neon-purple"
        : accent === "magenta"
          ? "text-neon-pink"
          : accent === "green"
            ? "text-emerald-400"
            : "text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-2xl glass-card p-5 sm:p-6 ${accentClasses} transition-all hover:border-white/20`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-white tracking-tight">
            {value}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">{label}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconClasses} bg-white/5`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}

// ----- Row actions menu for Data Grid -----
function InstitutionRowActions({
  row,
  onView,
  onEdit,
  onChangeMode,
  onSuspendActivate,
  onDelete,
  canManage,
}: {
  row: InstitutionRow;
  onView: (row: InstitutionRow) => void;
  onEdit: (row: InstitutionRow) => void;
  onChangeMode: (row: InstitutionRow) => void;
  onSuspendActivate: (row: InstitutionRow) => void;
  onDelete: (row: InstitutionRow) => void;
  canManage: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: "rgba(226,232,240,0.8)" }}
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              "& .MuiMenuItem-root": { color: "rgba(226,232,240,0.9)" },
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            onView(row);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <Eye className="h-4 w-4 text-neon-cyan" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        {canManage && (
          <>
            <MenuItem
              onClick={() => {
                onEdit(row);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <Pencil className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText>Edit Institution</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                onChangeMode(row);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                <RefreshCw className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText>Change Mode</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                onSuspendActivate(row);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>
                {row.status === "ACTIVE" ? (
                  <Ban className="h-4 w-4 text-amber-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                )}
              </ListItemIcon>
              <ListItemText>
                {row.status === "ACTIVE" ? "Suspend" : "Activate"}
              </ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                onDelete(row);
                setAnchorEl(null);
              }}
              sx={{ color: "rgba(239,68,68,0.9)" }}
            >
              <ListItemIcon>
                <Trash2 className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}

// ----- Custom toolbar for Data Grid -----
function InstitutionsToolbar() {
  return (
    <GridToolbarContainer
      sx={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        p: 1.5,
        gap: 1,
        flexWrap: "wrap",
        "& .MuiButton-root": { color: "rgba(0,245,255,0.9)" },
      }}
    >
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const platformRole =
    me?.kind === "platform_staff" ? (me.platformRole as PlatformRole) : null;
  const roleLabel = platformRole
    ? PLATFORM_ROLE_LABELS[platformRole]
    : "Super Admin";
  const canManageInstitutions =
    platformRole === "PLATFORM_OWNER" || platformRole === "PLATFORM_ADMIN";
  const canApproveOnboarding = [
    "PLATFORM_OWNER",
    "PLATFORM_ADMIN",
    "ONBOARDING_MANAGER",
  ].includes(platformRole ?? "");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchStats,
  });
  const { data: institutions = [], isLoading: institutionsLoading } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: fetchInstitutions,
  });
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: fetchOnboardingRequests,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateInstitution>[1] }) =>
      updateInstitution(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Institution updated");
    },
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteInstitution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Institution deleted");
      setDeleteModal(null);
    },
    onError: (err) => {
      toast.error("Delete failed", { description: err.message });
      setDeleteModal(null);
    },
  });
  const approveMutation = useMutation({
    mutationFn: approveOnboardingRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Request approved");
    },
    onError: (err) => toast.error("Approve failed", { description: err.message }),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectOnboardingRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Request rejected");
      setRejectModal(null);
    },
    onError: (err) => {
      toast.error("Reject failed", { description: err.message });
      setRejectModal(null);
    },
  });

  const [viewModal, setViewModal] = useState<InstitutionRow | null>(null);
  const [editModal, setEditModal] = useState<InstitutionRow | null>(null);
  const [modeModal, setModeModal] = useState<InstitutionRow | null>(null);
  const [deleteModal, setDeleteModal] = useState<InstitutionRow | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    row: OnboardingRequestRow;
    reason: string;
  } | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  const institutionColumns: GridColDef<InstitutionRow>[] = [
    {
      field: "logo",
      headerName: "",
      width: 48,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) => (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-cyan/20 text-neon-cyan font-display font-bold text-sm">
          {params.row.name.charAt(0).toUpperCase()}
        </div>
      ),
    },
    {
      field: "name",
      headerName: "Institution Name",
      flex: 1,
      minWidth: 160,
    },
    { field: "slug", headerName: "Slug", width: 120 },
    {
      field: "deploymentMode",
      headerName: "Deployment Mode",
      width: 130,
      valueFormatter: (v) =>
        v === "CLOUD" ? "Cloud" : v === "HYBRID" ? "Hybrid" : "Self-hosted",
    },
    {
      field: "adminName",
      headerName: "Admin Name",
      width: 140,
      valueGetter: (_, row) => row.onboardingRequest?.contactPerson ?? "—",
    },
    {
      field: "contactEmail",
      headerName: "Contact Email",
      width: 180,
      valueGetter: (_, row) => row.onboardingRequest?.contactEmail ?? "—",
    },
    {
      field: "studentCount",
      headerName: "Student Count",
      width: 120,
      type: "number",
      valueGetter: (_, row) => row._count.users,
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) => {
        const v = params.value as string;
        const isActive = v === "ACTIVE";
        return (
          <Chip
            size="small"
            label={isActive ? "Active" : "Suspended"}
            color={isActive ? "success" : "default"}
            variant="outlined"
            sx={{
              fontWeight: 600,
              borderColor: isActive ? "rgba(34,197,94,0.5)" : "rgba(148,163,184,0.4)",
              color: isActive ? "#4ade80" : "rgba(148,163,184,0.9)",
            }}
          />
        );
      },
    },
    {
      field: "updatedAt",
      headerName: "Last Active",
      width: 110,
      valueFormatter: (_, row) =>
        new Date(row.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
    },
    {
      field: "createdAt",
      headerName: "Created At",
      width: 110,
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
      width: 64,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) => (
        <InstitutionRowActions
          row={params.row}
          onView={setViewModal}
          onEdit={setEditModal}
          onChangeMode={setModeModal}
          onSuspendActivate={(row) =>
            updateMutation.mutate({
              id: row.id,
              data: { status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
            })
          }
          onDelete={setDeleteModal}
          canManage={canManageInstitutions}
        />
      ),
    },
  ];

  return (
    <AdminShell activeNav="dashboard">
      <div className="relative min-h-screen bg-grid-pattern bg-space-950">
        {/* Hero */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center gap-3"
          >
            <div className="flex items-center gap-2 text-slate-400">
              <Activity className="h-5 w-5 text-neon-cyan/80" />
              <span className="text-sm font-medium">Command Center</span>
            </div>
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                bgcolor: "rgba(0,245,255,0.12)",
                color: "#00f5ff",
                fontWeight: 600,
                border: "1px solid rgba(0,245,255,0.3)",
              }}
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight"
          >
            Super Admin Dashboard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 mt-1 max-w-2xl"
          >
            Complete oversight and control over all institutions. Monitor health, manage onboarding, and drive platform growth.
          </motion.p>
        </div>

        {/* Hero metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <HeroMetricCard
            icon={Building2}
            value={statsLoading ? "—" : (stats?.totalInstitutions ?? 0)}
            label="Total Institutions"
            accent="cyan"
            delay={0.1}
          />
          <HeroMetricCard
            icon={Users}
            value={statsLoading ? "—" : (stats?.activeStudents ?? 0).toLocaleString()}
            label="Active Students"
            accent="purple"
            delay={0.15}
          />
          <HeroMetricCard
            icon={ClipboardList}
            value={statsLoading ? "—" : (stats?.pendingOnboardingRequests ?? 0)}
            label="Pending Onboarding"
            accent={pendingRequests.length > 0 ? "magenta" : undefined}
            delay={0.2}
          />
          <HeroMetricCard
            icon={Cpu}
            value={statsLoading ? "—" : (stats?.aiAgentsRunning ?? 0)}
            label="AI Agents Running"
            delay={0.25}
          />
          <HeroMetricCard
            icon={Activity}
            value={statsLoading ? "—" : `${stats?.systemHealthScore ?? 98}%`}
            label="System Health Score"
            accent="green"
            delay={0.3}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Main: Institutions + Onboarding */}
          <div className="xl:col-span-2 space-y-6">
            {/* Institutions Management */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl glass-card overflow-hidden border border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
                <h2 className="font-display text-lg font-semibold text-white">
                  Institutions Management
                </h2>
                <Button
                  component={Link}
                  href="/admin/institutions"
                  size="small"
                  endIcon={<ChevronRight className="h-4 w-4" />}
                  sx={{
                    color: "primary.main",
                    fontWeight: 600,
                    textTransform: "none",
                  }}
                >
                  View all
                </Button>
              </div>
              <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <Box
                  sx={{
                    minHeight: 360,
                    height: 420,
                    width: "100%",
                    "& .MuiDataGrid-root": { border: "none" },
                    "& .MuiDataGrid-cell": { color: "rgba(226,232,240,0.9)" },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(15,15,35,0.9)",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    },
                    "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(0,245,255,0.06)" },
                    "& .MuiDataGrid-cell:focus": { outline: "none" },
                  }}
                >
                  <DataGrid
                    rows={institutions}
                    columns={institutionColumns}
                    getRowId={(row) => row.id}
                    loading={institutionsLoading}
                    slots={{
                      toolbar: InstitutionsToolbar,
                      noRowsOverlay: () => (
                        <div className="flex flex-col items-center justify-center py-12 px-6">
                          <Building2 className="h-12 w-12 text-slate-600 mb-3" />
                          <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
                            No institutions yet
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                            Approved onboarding requests will create institutions here.
                          </Typography>
                        </div>
                      ),
                    }}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 5 } },
                    }}
                    disableRowSelectionOnClick
                  />
                </Box>
              </ThemeProvider>
            </motion.section>

            {/* Onboarding Requests Panel */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl glass-card overflow-hidden border border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10">
                <h2 className="font-display text-lg font-semibold text-white">
                  Onboarding Requests
                </h2>
                <Button
                  component={Link}
                  href="/admin/requests"
                  size="small"
                  endIcon={<ChevronRight className="h-4 w-4" />}
                  sx={{
                    color: "primary.main",
                    fontWeight: 600,
                    textTransform: "none",
                  }}
                >
                  View all
                </Button>
              </div>
              <div className="overflow-x-auto">
                {pendingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <ClipboardList className="h-12 w-12 text-slate-600 mb-3" />
                    <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
                      No pending requests
                    </Typography>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Institution</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Contact</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Submitted</th>
                        {canApproveOnboarding && (
                          <th className="text-right py-3 px-4 font-semibold text-slate-400">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.slice(0, 5).map((req) => (
                        <tr key={req.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white font-medium">{req.institutionName}</td>
                          <td className="py-3 px-4 text-slate-400">{req.contactEmail}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(req.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          {canApproveOnboarding && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => approveMutation.mutate(req.id)}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  startIcon={<Check className="h-4 w-4" />}
                                  sx={{ textTransform: "none", fontWeight: 600 }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => setRejectModal({ row: req, reason: "" })}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  startIcon={<X className="h-4 w-4" />}
                                  sx={{ textTransform: "none", fontWeight: 600 }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.section>
          </div>

          {/* Sidebar: AI Insights + Activity */}
          <div className="space-y-6">
            {/* AI Insights */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl glass-card overflow-hidden border border-white/10"
            >
              <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
                <Sparkles className="h-5 w-5 text-neon-cyan" />
                <h2 className="font-display text-lg font-semibold text-white">
                  AI Insights
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p className="text-sm font-medium text-neon-cyan mb-1">Recommendation</p>
                  <p className="text-slate-300 text-sm">
                    Consider enabling AI tutoring agents for institutions with 100+ students to improve engagement.
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p className="text-sm font-medium text-neon-purple mb-1">Trend</p>
                  <p className="text-slate-300 text-sm">
                    Onboarding requests up 24% this month. Review SLA for approval turnaround.
                  </p>
                </div>
                <p className="text-xs text-slate-500">Real-time insights powered by platform analytics.</p>
              </div>
            </motion.section>

            {/* Recent Activity */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl glass-card overflow-hidden border border-white/10"
            >
              <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
                <Clock className="h-5 w-5 text-slate-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  Recent Activity
                </h2>
              </div>
              <ul className="divide-y divide-white/5">
                {MOCK_ACTIVITY.map((item) => (
                  <li key={item.id} className="px-6 py-3 hover:bg-white/5 transition-colors">
                    <p className="text-sm text-white font-medium">{item.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.target} · {item.time}</p>
                  </li>
                ))}
              </ul>
            </motion.section>

            {/* Mini chart */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl glass-card overflow-hidden border border-white/10 p-6"
            >
              <h3 className="font-display text-sm font-semibold text-white mb-4">Growth (7 days)</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_CHART_DATA}>
                    <defs>
                      <linearGradient id="colorInstitutions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00f5ff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#00f5ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(148,163,184,0.6)" fontSize={11} />
                    <YAxis stroke="rgba(148,163,184,0.6)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15,15,35,0.98)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="institutions"
                      stroke="#00f5ff"
                      fillOpacity={1}
                      fill="url(#colorInstitutions)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>
        </div>
      </div>

      {/* View institution modal */}
      <Dialog
        open={Boolean(viewModal)}
        onClose={() => setViewModal(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          },
        }}
      >
        {viewModal && (
          <>
            <DialogTitle className="font-display">Institution Details</DialogTitle>
            <DialogContent>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-slate-500">Name</dt><dd className="text-white font-medium">{viewModal.name}</dd></div>
                <div><dt className="text-slate-500">Slug</dt><dd className="text-white">{viewModal.slug}</dd></div>
                <div><dt className="text-slate-500">Mode</dt><dd className="text-white">{viewModal.deploymentMode}</dd></div>
                <div><dt className="text-slate-500">Status</dt><dd className="text-white">{viewModal.status}</dd></div>
                <div><dt className="text-slate-500">Users / Courses</dt><dd className="text-white">{viewModal._count.users} / {viewModal._count.courses}</dd></div>
                <div><dt className="text-slate-500">Contact</dt><dd className="text-white">{viewModal.onboardingRequest?.contactEmail ?? "—"}</dd></div>
              </dl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewModal(null)} sx={{ color: "rgba(226,232,240,0.8)" }}>Close</Button>
              {canManageInstitutions && (
                <Button variant="contained" color="primary" onClick={() => { setEditModal(viewModal); setViewModal(null); }}>
                  Edit
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Edit institution modal */}
      <Dialog
        open={Boolean(editModal)}
        onClose={() => setEditModal(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          },
        }}
      >
        {editModal && (
          <EditInstitutionForm
            row={editModal}
            onClose={() => setEditModal(null)}
            onSave={(data) => {
              updateMutation.mutate({ id: editModal.id, data });
              setEditModal(null);
            }}
            isLoading={updateMutation.isPending}
          />
        )}
      </Dialog>

      {/* Change mode modal */}
      <Dialog
        open={Boolean(modeModal)}
        onClose={() => setModeModal(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          },
        }}
      >
        {modeModal && (
          <>
            <DialogTitle className="font-display">Change deployment mode</DialogTitle>
            <DialogContent>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel id="mode-label">Mode</InputLabel>
                <Select
                  labelId="mode-label"
                  label="Mode"
                  defaultValue={modeModal.deploymentMode}
                  onChange={(e) => {
                    updateMutation.mutate({
                      id: modeModal.id,
                      data: { deploymentMode: e.target.value as "CLOUD" | "SELF_HOSTED" | "HYBRID" },
                    });
                    setModeModal(null);
                  }}
                  sx={{ color: "#e2e8f0" }}
                >
                  <MenuItem value="CLOUD">Cloud</MenuItem>
                  <MenuItem value="HYBRID">Hybrid</MenuItem>
                  <MenuItem value="SELF_HOSTED">Self-hosted</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setModeModal(null)} sx={{ color: "rgba(226,232,240,0.8)" }}>Cancel</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog
        open={Boolean(deleteModal)}
        onClose={() => setDeleteModal(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          },
        }}
      >
        {deleteModal && (
          <>
            <DialogTitle className="font-display text-red-400">Delete institution?</DialogTitle>
            <DialogContent>
              <p className="text-slate-300 text-sm">
                This will permanently delete <strong className="text-white">{deleteModal.name}</strong> and all associated data. This action cannot be undone.
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteModal(null)} sx={{ color: "rgba(226,232,240,0.8)" }}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => deleteMutation.mutate(deleteModal.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Reject request modal */}
      <Dialog
        open={Boolean(rejectModal)}
        onClose={() => setRejectModal(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: "rgba(15,15,35,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
            },
          },
        }}
      >
        {rejectModal && (
          <>
            <DialogTitle className="font-display">Reject onboarding request</DialogTitle>
            <DialogContent>
              <p className="text-slate-300 text-sm mb-4">
                Reject request for <strong className="text-white">{rejectModal.row.institutionName}</strong>?
              </p>
              <TextField
                fullWidth
                label="Reason (optional)"
                multiline
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((p) => p ? { ...p, reason: e.target.value } : null)}
                sx={{
                  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                  "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRejectModal(null)} sx={{ color: "rgba(226,232,240,0.8)" }}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => rejectMutation.mutate({ id: rejectModal.row.id, reason: rejectModal.reason })}
                disabled={rejectMutation.isPending}
              >
                Reject
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </AdminShell>
  );
}

function EditInstitutionForm({
  row,
  onClose,
  onSave,
  isLoading,
}: {
  row: InstitutionRow;
  onClose: () => void;
  onSave: (data: { name?: string; slug?: string; deploymentMode?: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [deploymentMode, setDeploymentMode] = useState(row.deploymentMode);

  return (
    <>
      <DialogTitle className="font-display">Edit institution</DialogTitle>
      <DialogContent>
        <div className="space-y-4 pt-2">
          <TextField
            fullWidth
            label="Institution name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
              "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
            }}
          />
          <TextField
            fullWidth
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            helperText="Lowercase letters, numbers, hyphens only."
            sx={{
              "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
              "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
            }}
          />
          <FormControl fullWidth>
            <InputLabel id="edit-mode-label">Deployment mode</InputLabel>
            <Select
              labelId="edit-mode-label"
              label="Deployment mode"
              value={deploymentMode}
              onChange={(e) => setDeploymentMode(e.target.value as "CLOUD" | "SELF_HOSTED" | "HYBRID")}
              sx={{ color: "#e2e8f0" }}
            >
              <MenuItem value="CLOUD">Cloud</MenuItem>
              <MenuItem value="HYBRID">Hybrid</MenuItem>
              <MenuItem value="SELF_HOSTED">Self-hosted</MenuItem>
            </Select>
          </FormControl>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: "rgba(226,232,240,0.8)" }}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          disabled={isLoading || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim().toLowerCase(), deploymentMode })}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}
