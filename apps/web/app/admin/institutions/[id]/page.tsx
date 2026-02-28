"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  ArrowLeft,
  Building2,
  Users,
  BookOpen,
  Mail,
  User,
  Calendar,
  RefreshCw,
  Pencil,
  Ban,
  CheckCircle,
  Trash2,
  DollarSign,
  Send,
} from "lucide-react";
import { AdminShell } from "../../components/admin-shell";
import { useMe } from "@/hooks/use-me";
import type { PlatformRole } from "@/lib/platform-roles";

type InstitutionDetail = {
  id: string;
  name: string;
  slug: string;
  clerkOrgId: string;
  deploymentMode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  paymentVerifiedAt: string | null;
  _count: { users: number; courses: number };
  onboardingRequest: {
    id: string;
    institutionName: string;
    contactPerson: string;
    contactEmail: string;
    status: string;
  } | null;
};

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    secondary: { main: "#a855f7" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.8)" },
  },
  typography: {
    fontFamily: "var(--font-display), system-ui, sans-serif",
  },
});

async function fetchInstitution(id: string): Promise<InstitutionDetail> {
  const res = await fetch(`/api/admin/institutions/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Institution not found.");
    if (res.status === 403) throw new Error("You don't have access to view this institution.");
    throw new Error("Failed to load institution.");
  }
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Update failed");
  return body;
}

async function deleteInstitution(id: string) {
  const res = await fetch(`/api/admin/institutions/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Delete failed");
  }
}

const MODE_LABELS: Record<string, string> = {
  SIS: "SIS",
  LMS: "LMS",
  HYBRID: "Hybrid (SIS+LMS)",
};

export default function AdminInstitutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: me } = useMe();
  const platformRole = me?.kind === "platform_staff" ? (me.platformRole as PlatformRole) : null;
  const canManage =
    me?.kind === "platform_staff" && "canManageInstitutions" in me
      ? (me as { canManageInstitutions?: boolean }).canManageInstitutions === true
      : platformRole === "PLATFORM_OWNER" || platformRole === "PLATFORM_ADMIN";

  const { data: institution, isLoading, error } = useQuery({
    queryKey: ["admin-institution", id],
    queryFn: () => fetchInstitution(id),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateInstitution>[1]) =>
      updateInstitution(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institution", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Institution updated");
      setEditOpen(false);
    },
    onError: (err) => toast.error("Update failed", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInstitution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Institution deleted");
      setDeleteOpen(false);
      router.push("/admin/institutions");
    },
    onError: (err) => {
      toast.error("Delete failed", { description: err.message });
      setDeleteOpen(false);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (params: { to: string; subject: string; body: string }) => {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to send email");
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent");
      setEmailOpen(false);
      setEmailSubject("");
      setEmailBody("");
    },
    onError: (err) => {
      toast.error("Send failed", { description: err.message });
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  if (!id) {
    return (
      <AdminShell activeNav="institutions">
        <Typography color="error">Missing institution ID.</Typography>
        <Button component={Link} href="/admin/institutions" sx={{ mt: 2 }}>
          Back to institutions
        </Button>
      </AdminShell>
    );
  }

  if (error || (!isLoading && !institution)) {
    return (
      <AdminShell activeNav="institutions">
        <Box className="rounded-2xl glass-card border border-white/10 p-8 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-500 mb-4" />
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            {(error as Error)?.message ?? "Institution not found."}
          </Typography>
          <Button
            component={Link}
            href="/admin/institutions"
            startIcon={<ArrowLeft className="h-4 w-4" />}
            sx={{ color: "primary.main" }}
          >
            Back to institutions
          </Button>
        </Box>
      </AdminShell>
    );
  }

  return (
    <AdminShell activeNav="institutions">
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div className="space-y-6">
          {/* Back + title */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              component={Link}
              href="/admin/institutions"
              startIcon={<ArrowLeft className="h-4 w-4" />}
              sx={{
                color: "rgba(226,232,240,0.8)",
                textTransform: "none",
                "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#e2e8f0" },
              }}
            >
              Institutions
            </Button>
            {institution && (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan font-display font-bold text-xl">
                  {institution.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                    {institution.name}
                  </h1>
                  <p className="text-sm text-slate-400">{institution.slug}</p>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-2xl glass-card border border-white/10 p-8 text-center">
              <Typography color="text.secondary">Loading…</Typography>
            </div>
          ) : institution ? (
            <>
              {/* Status + actions */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl glass-card border border-white/10 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Chip
                    size="small"
                    label={institution.status === "ACTIVE" ? "Active" : "Suspended"}
                    color={institution.status === "ACTIVE" ? "success" : "default"}
                    variant="outlined"
                    sx={{
                      fontWeight: 600,
                      borderColor:
                        institution.status === "ACTIVE"
                          ? "rgba(34,197,94,0.5)"
                          : "rgba(148,163,184,0.4)",
                      color:
                        institution.status === "ACTIVE"
                          ? "#4ade80"
                          : "rgba(148,163,184,0.9)",
                    }}
                  />
                  <span className="text-slate-400 text-sm">
                    {MODE_LABELS[institution.deploymentMode] ?? institution.deploymentMode}
                  </span>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Pencil className="h-4 w-4" />}
                      onClick={() => setEditOpen(true)}
                      sx={{
                        color: "rgba(226,232,240,0.9)",
                        borderColor: "rgba(255,255,255,0.2)",
                        textTransform: "none",
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        institution.status === "ACTIVE" ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )
                      }
                      onClick={() =>
                        updateMutation.mutate({
                          status:
                            institution.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        })
                      }
                      disabled={updateMutation.isPending}
                      sx={{
                        color:
                          institution.status === "ACTIVE"
                            ? "rgba(234,179,8,0.9)"
                            : "rgba(34,197,94,0.9)",
                        borderColor:
                          institution.status === "ACTIVE"
                            ? "rgba(234,179,8,0.4)"
                            : "rgba(34,197,94,0.4)",
                        textTransform: "none",
                      }}
                    >
                      {institution.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setDeleteOpen(true)}
                      sx={{ textTransform: "none" }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </motion.div>

              {/* Details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-2xl glass-card border border-white/10 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-white/10">
                    <h2 className="font-display text-lg font-semibold text-white">
                      Institution details
                    </h2>
                  </div>
                  <dl className="p-6 space-y-4">
                    <DetailRow
                      icon={Building2}
                      label="Name"
                      value={institution.name}
                    />
                    <DetailRow label="Slug" value={institution.slug} />
                    <DetailRow
                      label="Clerk org ID"
                      value={institution.clerkOrgId}
                      mono
                    />
                    <DetailRow
                      icon={RefreshCw}
                      label="Deployment mode"
                      value={MODE_LABELS[institution.deploymentMode] ?? institution.deploymentMode}
                      action={
                        canManage ? (
                          <button
                            type="button"
                            onClick={() => setEditOpen(true)}
                            className="text-xs font-medium text-neon-cyan hover:underline"
                          >
                            Change
                          </button>
                        ) : undefined
                      }
                    />
                    <DetailRow
                      icon={Calendar}
                      label="Created"
                      value={new Date(institution.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                    <DetailRow
                      icon={Calendar}
                      label="Last updated"
                      value={new Date(institution.updatedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                    <DetailRow
                      icon={DollarSign}
                      label="Payment completed"
                      value={
                        institution.paymentVerifiedAt
                          ? new Date(institution.paymentVerifiedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"
                      }
                    />
                  </dl>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl glass-card border border-white/10 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-white/10">
                    <h2 className="font-display text-lg font-semibold text-white">
                      Usage & contact
                    </h2>
                  </div>
                  <dl className="p-6 space-y-4">
                    <DetailRow
                      icon={Users}
                      label="Users"
                      value={String(institution._count.users)}
                    />
                    <DetailRow
                      icon={BookOpen}
                      label="Courses"
                      value={String(institution._count.courses)}
                    />
                    {institution.onboardingRequest ? (
                      <>
                        <DetailRow
                          icon={User}
                          label="Contact person"
                          value={institution.onboardingRequest.contactPerson}
                        />
                        <DetailRow
                          icon={Mail}
                          label="Contact email"
                          value={institution.onboardingRequest.contactEmail}
                        />
                        <div className="pt-2">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Send className="h-4 w-4" />}
                            onClick={() => {
                              setEmailTo(institution.onboardingRequest!.contactEmail);
                              setEmailSubject("");
                              setEmailBody("");
                              setEmailOpen(true);
                            }}
                            sx={{
                              color: "rgba(148,163,184,0.9)",
                              borderColor: "rgba(148,163,184,0.4)",
                              textTransform: "none",
                              fontWeight: 600,
                            }}
                          >
                            Email institution
                          </Button>
                        </div>
                      </>
                    ) : (
                      <DetailRow
                        icon={Mail}
                        label="Contact"
                        value="—"
                      />
                    )}
                  </dl>
                </motion.section>
              </div>
            </>
          ) : null}
        </div>

        {/* Edit dialog */}
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
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
          {institution && (
            <EditInstitutionForm
              institution={institution}
              onClose={() => setEditOpen(false)}
              onSave={(data) => updateMutation.mutate(data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </Dialog>

        {/* Delete confirmation */}
        <Dialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
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
          {institution && (
            <>
              <DialogTitle className="font-display text-red-400">
                Delete institution?
              </DialogTitle>
              <DialogContent>
                <p className="text-slate-300 text-sm">
                  This will permanently delete{" "}
                  <strong className="text-white">{institution.name}</strong> and
                  all associated data. This action cannot be undone.
                </p>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setDeleteOpen(false)}
                  sx={{ color: "rgba(226,232,240,0.8)" }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Email institution */}
        <Dialog
          open={emailOpen}
          onClose={() => !sendEmailMutation.isPending && setEmailOpen(false)}
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
          <DialogTitle className="font-display">Email institution</DialogTitle>
          <DialogContent>
            <p className="text-slate-400 text-sm mb-4">
              Send an email to the institution contact. They can reply to continue the conversation.
            </p>
            <TextField
              fullWidth
              label="To"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              margin="normal"
              sx={{
                "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
              }}
            />
            <TextField
              fullWidth
              label="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              margin="normal"
              placeholder="e.g. Follow-up — SILS platform"
              sx={{
                "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
              }}
            />
            <TextField
              fullWidth
              label="Message"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              margin="normal"
              multiline
              rows={6}
              placeholder="Write your message…"
              sx={{
                "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setEmailOpen(false)}
              disabled={sendEmailMutation.isPending}
              sx={{ color: "rgba(226,232,240,0.8)" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Send className="h-4 w-4" />}
              onClick={() =>
                sendEmailMutation.mutate({
                  to: emailTo.trim(),
                  subject: emailSubject.trim(),
                  body: emailBody.trim(),
                })
              }
              disabled={
                sendEmailMutation.isPending ||
                !emailTo.trim() ||
                !emailSubject.trim() ||
                !emailBody.trim()
              }
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {sendEmailMutation.isPending ? "Sending…" : "Send email"}
            </Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>
    </AdminShell>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </dt>
        <dd
          className={
            "mt-0.5 text-sm font-medium text-white " + (mono ? "font-mono" : "")
          }
        >
          <span className="flex items-center gap-2 flex-wrap">
            {value}
            {action}
          </span>
        </dd>
      </div>
    </div>
  );
}

function EditInstitutionForm({
  institution,
  onClose,
  onSave,
  isLoading,
}: {
  institution: InstitutionDetail;
  onClose: () => void;
  onSave: (data: {
    name?: string;
    slug?: string;
    deploymentMode?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(institution.name);
  const [slug, setSlug] = useState(institution.slug);
  const [deploymentMode, setDeploymentMode] = useState(institution.deploymentMode);

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
              onChange={(e) =>
                setDeploymentMode(e.target.value as "SIS" | "LMS" | "HYBRID")
              }
              sx={{ color: "#e2e8f0" }}
            >
              <MenuItem value="SIS">SIS</MenuItem>
              <MenuItem value="LMS">LMS</MenuItem>
              <MenuItem value="HYBRID">Hybrid (SIS+LMS)</MenuItem>
            </Select>
            <p className="text-xs text-slate-500 mt-1.5">
              Institutions may request a different mode; update here when approved.
            </p>
          </FormControl>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: "rgba(226,232,240,0.8)" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={isLoading || !name.trim() || !slug.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              slug: slug.trim().toLowerCase(),
              deploymentMode,
            })
          }
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}
