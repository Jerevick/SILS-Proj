"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  AdminDataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from "@/components/admin/data-grid";
import { ActionsCell } from "@/components/admin/actions-cell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Users,
  ClipboardList,
  Cpu,
  Activity,
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
import {
  institutionsResponseSchema,
  onboardingRequestsResponseSchema,
  type InstitutionRowSchema,
  type OnboardingRequestRowSchema,
} from "@/lib/admin-schemas";

// ----- Types -----
type AdminStats = {
  totalInstitutions: number;
  activeStudents: number;
  pendingOnboardingRequests: number;
  aiAgentsRunning: number;
  systemHealthScore: number;
};

// ----- API -----
async function fetchStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchInstitutions(): Promise<InstitutionRowSchema[]> {
  const res = await fetch("/api/admin/institutions");
  if (!res.ok) throw new Error("Failed to fetch institutions");
  const data = await res.json();
  return institutionsResponseSchema.parse(data);
}

async function fetchOnboardingRequests(): Promise<OnboardingRequestRowSchema[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  const data = await res.json();
  return onboardingRequestsResponseSchema.parse(data);
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

async function rejectOnboardingRequest(id: string, reason: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Reject failed");
  }
}

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

// ----- Row actions: use ActionsCell in columns -----

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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
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

  const [viewModal, setViewModal] = useState<InstitutionRowSchema | null>(null);
  const [editModal, setEditModal] = useState<InstitutionRowSchema | null>(null);
  const [modeModal, setModeModal] = useState<InstitutionRowSchema | null>(null);
  const [deleteModal, setDeleteModal] = useState<InstitutionRowSchema | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    row: OnboardingRequestRowSchema;
    reason: string;
  } | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  const institutionColumns: GridColDef<InstitutionRowSchema>[] = [
    {
      field: "logo",
      headerName: "",
      width: 48,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<InstitutionRowSchema>) => (
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
      valueFormatter: (v: string) =>
        v === "SIS" ? "SIS" : v === "LMS" ? "LMS" : "Hybrid (SIS+LMS)",
    },
    {
      field: "adminName",
      headerName: "Admin Name",
      width: 140,
      valueGetter: (_: unknown, row: InstitutionRowSchema) => row.onboardingRequest?.contactPerson ?? "—",
    },
    {
      field: "contactEmail",
      headerName: "Contact Email",
      width: 180,
      valueGetter: (_: unknown, row: InstitutionRowSchema) => row.onboardingRequest?.contactEmail ?? "—",
    },
    {
      field: "studentCount",
      headerName: "Student Count",
      width: 120,
      type: "number",
      valueGetter: (_: unknown, row: InstitutionRowSchema) => row._count?.users ?? 0,
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params: GridRenderCellParams<InstitutionRowSchema>) => {
        const v = (params.value ?? params.row.status) as string;
        const isActive = v === "ACTIVE";
        return (
          <span
            className={
              isActive
                ? "inline-flex items-center rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400"
                : "inline-flex items-center rounded-md border border-slate-500/50 bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-400"
            }
          >
            {isActive ? "Active" : "Suspended"}
          </span>
        );
      },
    },
    {
      field: "updatedAt",
      headerName: "Last Active",
      width: 110,
      valueFormatter: (_: unknown, row: InstitutionRowSchema) =>
        new Date(row.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
    },
    {
      field: "createdAt",
      headerName: "Created At",
      width: 110,
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
        const actions = [
          {
            label: "View Details",
            icon: Eye,
            onClick: () => setViewModal(row),
          },
          ...(canManageInstitutions
            ? [
                { label: "Edit Institution", icon: Pencil, onClick: () => setEditModal(row) },
                { label: "Change Mode", icon: RefreshCw, onClick: () => setModeModal(row) },
                {
                  label: row.status === "ACTIVE" ? "Suspend" : "Activate",
                  icon: row.status === "ACTIVE" ? Ban : CheckCircle,
                  onClick: () =>
                    updateMutation.mutate({
                      id: row.id,
                      data: { status: row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
                    }),
                },
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: () => setDeleteModal(row),
                  variant: "destructive" as const,
                },
              ]
            : []),
        ];
        return <ActionsCell row={row} actions={actions} />;
      },
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
            <span className="rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-xs font-semibold text-neon-cyan">
              {roleLabel}
            </span>
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
                <Button asChild size="sm" className="font-semibold text-neon-cyan hover:bg-neon-cyan/20">
                  <Link href="/admin/institutions" className="flex items-center gap-1">
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <AdminDataGrid<InstitutionRowSchema>
                    rows={institutions}
                    columns={institutionColumns}
                    getRowId={(row) => row.id}
                    loading={institutionsLoading}
                    showToolbar
                    height={420}
                    slots={{
                      noRowsOverlay: () => (
                        <div className="flex flex-col items-center justify-center py-12 px-6">
                          <Building2 className="h-12 w-12 text-slate-600 mb-3" />
                          <p className="text-slate-400 font-medium">No institutions yet</p>
                          <p className="text-slate-400 text-sm mt-0.5">Approved onboarding requests will create institutions here.</p>
                        </div>
                      ),
                    }}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 5 } },
                    }}
                    disableRowSelectionOnClick
                  />
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
                <Button asChild size="sm" className="font-semibold text-neon-cyan hover:bg-neon-cyan/20">
                  <Link href="/admin/requests" className="flex items-center gap-1">
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="overflow-x-auto">
                {pendingRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <ClipboardList className="h-12 w-12 text-slate-600 mb-3" />
                      <p className="text-slate-400 font-medium">No pending requests</p>
                    </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Institution</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Contact</th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-400">Submitted</th>
                        {canApproveOnboarding && (
                          <th className="text-right py-3 px-4 font-semibold text-slate-400 min-w-[200px]">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.slice(0, 5).map((req) => (
                        <tr key={req.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-4 text-white font-medium align-middle">{req.institutionName}</td>
                          <td className="py-3 px-4 text-slate-400 align-middle">{req.contactEmail}</td>
                          <td className="py-3 px-4 text-slate-400 align-middle">
                            {new Date(req.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          {canApproveOnboarding && (
                            <td className="py-3 px-4 align-middle">
                              <div className="flex flex-nowrap items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(req.id)}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim font-semibold"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRejectModal({ row: req, reason: "" })}
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold"
                                >
                                  <X className="h-4 w-4 mr-1" />
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
      <Dialog open={Boolean(viewModal)} onOpenChange={(open) => !open && setViewModal(null)}>
        <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
          {viewModal && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-white">Institution Details</DialogTitle>
              </DialogHeader>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-slate-500">Name</dt><dd className="text-white font-medium">{viewModal.name}</dd></div>
                <div><dt className="text-slate-500">Slug</dt><dd className="text-white">{viewModal.slug}</dd></div>
                <div><dt className="text-slate-500">Mode</dt><dd className="text-white">{viewModal.deploymentMode}</dd></div>
                <div><dt className="text-slate-500">Status</dt><dd className="text-white">{viewModal.status}</dd></div>
                <div><dt className="text-slate-500">Users / Courses</dt><dd className="text-white">{viewModal._count?.users ?? 0} / {viewModal._count?.courses ?? 0}</dd></div>
                <div><dt className="text-slate-500">Contact</dt><dd className="text-white">{viewModal.onboardingRequest?.contactEmail ?? "—"}</dd></div>
              </dl>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setViewModal(null)} className="text-slate-300 hover:text-white">Close</Button>
                {canManageInstitutions && (
                  <Button className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim" onClick={() => { setEditModal(viewModal); setViewModal(null); }}>
                    Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit institution modal */}
      <Dialog open={Boolean(editModal)} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
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
        </DialogContent>
      </Dialog>

      {/* Change mode modal */}
      <Dialog open={Boolean(modeModal)} onOpenChange={(open) => !open && setModeModal(null)}>
        <DialogContent className="max-w-xs border-white/10 bg-space-800 text-slate-200">
          {modeModal && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-white">Change deployment mode</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-2">
                <Label className="text-slate-400">Mode</Label>
                <Select
                  defaultValue={modeModal.deploymentMode}
                  onValueChange={(value) => {
                    updateMutation.mutate({
                      id: modeModal.id,
                      data: { deploymentMode: value as "SIS" | "LMS" | "HYBRID" },
                    });
                    setModeModal(null);
                  }}
                >
                  <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIS">SIS</SelectItem>
                    <SelectItem value="LMS">LMS</SelectItem>
                    <SelectItem value="HYBRID">Hybrid (SIS+LMS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setModeModal(null)} className="text-slate-300 hover:text-white">Cancel</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={Boolean(deleteModal)} onOpenChange={(open) => !open && setDeleteModal(null)}>
        <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
          {deleteModal && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-red-400">Delete institution?</DialogTitle>
              </DialogHeader>
              <p className="text-slate-300 text-sm">
                This will permanently delete <strong className="text-white">{deleteModal.name}</strong> and all associated data. This action cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteModal(null)} className="text-slate-300 hover:text-white">Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deleteModal.id)}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject request modal */}
      <Dialog open={Boolean(rejectModal)} onOpenChange={(open) => !open && setRejectModal(null)}>
        <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
          {rejectModal && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-white">Reject onboarding request</DialogTitle>
              </DialogHeader>
              <p className="text-slate-300 text-sm mb-4">
                Reject request for <strong className="text-white">{rejectModal.row.institutionName}</strong>? Please provide a reason so the institution can be informed.
              </p>
              <div className="space-y-2">
                <Label className="text-slate-400">Reason for rejection</Label>
                <Textarea
                  placeholder="e.g. Missing documentation, does not meet criteria…"
                  rows={3}
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal((p) => p ? { ...p, reason: e.target.value } : null)}
                  className="border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500 resize-none"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRejectModal(null)} className="text-slate-300 hover:text-white">Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ id: rejectModal.row.id, reason: rejectModal.reason })}
                  disabled={rejectMutation.isPending || !rejectModal.reason.trim()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Reject
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
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
  row: InstitutionRowSchema;
  onClose: () => void;
  onSave: (data: { name?: string; slug?: string; deploymentMode?: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [deploymentMode, setDeploymentMode] = useState(row.deploymentMode);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-white">Edit institution</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label className="text-slate-400">Institution name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-white/20 bg-transparent text-slate-200"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-400">Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border-white/20 bg-transparent text-slate-200"
          />
          <p className="text-xs text-slate-500">Lowercase letters, numbers, hyphens only.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-400">Deployment mode</Label>
          <Select value={deploymentMode} onValueChange={(v) => setDeploymentMode(v as "SIS" | "LMS" | "HYBRID")}>
            <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SIS">SIS</SelectItem>
              <SelectItem value="LMS">LMS</SelectItem>
              <SelectItem value="HYBRID">Hybrid (SIS+LMS)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">Cancel</Button>
        <Button
          onClick={() => onSave({ name: name.trim(), slug: slug.trim().toLowerCase(), deploymentMode })}
          disabled={isLoading || !name.trim() || !slug.trim()}
          className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
