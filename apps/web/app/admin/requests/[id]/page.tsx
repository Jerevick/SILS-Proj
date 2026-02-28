"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Users,
  Calendar,
  CheckCircle,
  X,
  ExternalLink,
  MapPin,
  Award,
  FileText,
  Send,
} from "lucide-react";
import { AdminShell } from "../../components/admin-shell";
import { useMe } from "@/hooks/use-me";

type OnboardingRequestDetail = {
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
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  tenantId: string | null;
  tenant: {
    id: string;
    slug: string;
    name: string;
    termsAcceptedAt: string | null;
  } | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressStateRegion: string | null;
  addressPostalCode: string | null;
  yearFounded: number | null;
  institutionType: string | null;
  legalEntityName: string | null;
  taxIdOrRegistrationNumber: string | null;
  accreditationStatus: string | null;
  accreditationBody: string | null;
  accreditationCertificateUrl: string | null;
  missionOrDescription: string | null;
  numberOfCampuses: number | null;
  financialVerifiedAt: string | null;
  financialVerifiedBy: string | null;
  quotationSentAt: string | null;
  quotationInvoiceNumber: string | null;
  termsAcceptUrl: string | null;
  termsQuotationUrl: string;
  termsAcceptedAt: string | null;
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

const MODE_LABELS: Record<string, string> = {
  SIS: "SIS",
  LMS: "LMS",
  HYBRID: "Hybrid (SIS+LMS)",
};

async function fetchRequest(id: string): Promise<OnboardingRequestDetail> {
  const res = await fetch(`/api/onboarding/requests/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Request not found.");
    if (res.status === 403)
      throw new Error("You don't have access to view this request.");
    throw new Error("Failed to load request.");
  }
  return res.json();
}

async function approveRequest(id: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Approval failed");
  return data;
}

async function rejectRequest(id: string, reason: string) {
  const res = await fetch(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Rejection failed");
  return data;
}

export default function AdminRequestDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: me } = useMe();
  const canApprove =
    me?.kind === "platform_staff" &&
    ["PLATFORM_OWNER", "PLATFORM_ADMIN", "ONBOARDING_MANAGER"].includes(
      me.platformRole ?? ""
    );

  const { data: request, isLoading, error } = useQuery({
    queryKey: ["onboarding-request", id],
    queryFn: () => fetchRequest(id),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-request", id] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Request approved", {
        description:
          "The institution has been onboarded and the contact will receive a welcome email.",
      });
    },
    onError: (err) =>
      toast.error("Approval failed", { description: err.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-request", id] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Request rejected");
      setRejectOpen(false);
    },
    onError: (err) => {
      toast.error("Rejection failed", { description: err.message });
      setRejectOpen(false);
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

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  if (!id) {
    return (
      <AdminShell activeNav="requests">
        <Typography color="error">Missing request ID.</Typography>
        <Button component={Link} href="/admin/requests" sx={{ mt: 2 }}>
          Back to requests
        </Button>
      </AdminShell>
    );
  }

  if (error || (!isLoading && !request)) {
    return (
      <AdminShell activeNav="requests">
        <Box className="rounded-2xl glass-card border border-white/10 p-8 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-500 mb-4" />
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            {(error as Error)?.message ?? "Request not found."}
          </Typography>
          <Button
            component={Link}
            href="/admin/requests"
            startIcon={<ArrowLeft className="h-4 w-4" />}
            sx={{ color: "primary.main" }}
          >
            Back to requests
          </Button>
        </Box>
      </AdminShell>
    );
  }

  return (
    <AdminShell activeNav="requests">
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div className="space-y-6">
          {/* Back + title */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              component={Link}
              href="/admin/requests"
              startIcon={<ArrowLeft className="h-4 w-4" />}
              sx={{
                color: "rgba(226,232,240,0.8)",
                textTransform: "none",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                },
              }}
            >
              Onboarding requests
            </Button>
            {request && (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan font-display font-bold text-xl">
                  {request.institutionName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                    {request.institutionName}
                  </h1>
                  <p className="text-sm text-slate-400">{request.slug}</p>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-2xl glass-card border border-white/10 p-8 text-center">
              <Typography color="text.secondary">Loading…</Typography>
            </div>
          ) : request ? (
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
                    label={request.status}
                    color={
                      request.status === "APPROVED"
                        ? "success"
                        : request.status === "REJECTED"
                          ? "error"
                          : "default"
                    }
                    variant="outlined"
                    sx={{
                      fontWeight: 600,
                      borderColor:
                        request.status === "APPROVED"
                          ? "rgba(34,197,94,0.5)"
                          : request.status === "REJECTED"
                            ? "rgba(239,68,68,0.5)"
                            : "rgba(148,163,184,0.4)",
                      color:
                        request.status === "APPROVED"
                          ? "#4ade80"
                          : request.status === "REJECTED"
                            ? "#f87171"
                            : "rgba(148,163,184,0.9)",
                    }}
                  />
                  {request.status === "PENDING" && (
                    request.quotationSentAt ? (
                      <Chip
                        size="small"
                        label={`Quotation sent ${new Date(request.quotationSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          borderColor: "rgba(148,163,184,0.4)",
                          color: "rgba(148,163,184,0.9)",
                        }}
                      />
                    ) : (
                      <span className="text-slate-500 text-sm">Quotation not sent</span>
                    )
                  )}
                  {request.status === "PENDING" && (
                    request.financialVerifiedAt ? (
                      <Chip
                        size="small"
                        label="Payment received"
                        color="success"
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          borderColor: "rgba(34,197,94,0.5)",
                          color: "#4ade80",
                        }}
                      />
                    ) : (
                      <span className="text-slate-500 text-sm">Payment not received</span>
                    )
                  )}
                  {request.tenant && (
                    request.tenant.termsAcceptedAt ? (
                      <Chip
                        size="small"
                        label={`Terms accepted ${new Date(request.tenant.termsAcceptedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        color="success"
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          borderColor: "rgba(34,197,94,0.5)",
                          color: "#4ade80",
                        }}
                      />
                    ) : (
                      <span className="text-amber-400 text-sm">Terms not accepted</span>
                    )
                  )}
                  {request.status === "PENDING" && request.termsAcceptedAt && !request.tenant && (
                    <Chip
                      size="small"
                      label={`Terms accepted (quotation) ${new Date(request.termsAcceptedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      color="success"
                      variant="outlined"
                      sx={{
                        fontWeight: 600,
                        borderColor: "rgba(34,197,94,0.5)",
                        color: "#4ade80",
                      }}
                    />
                  )}
                  {request.status !== "PENDING" && !request.tenant && (
                    <span className="text-slate-500 text-sm">Terms —</span>
                  )}
                  <span className="text-slate-400 text-sm">
                    {MODE_LABELS[request.deploymentMode] ?? request.deploymentMode}
                  </span>
                  {request.tenant && (
                    <Button
                      component={Link}
                      href={`/admin/institutions/${request.tenant.id}`}
                      size="small"
                      endIcon={<ExternalLink className="h-4 w-4" />}
                      sx={{
                        color: "primary.main",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      View institution
                    </Button>
                  )}
                  {request.contactEmail && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Mail className="h-4 w-4" />}
                      onClick={() => {
                        setEmailTo(request.contactEmail);
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
                  )}
                </div>
                {canApprove && request.status === "PENDING" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircle className="h-4 w-4" />}
                      onClick={() => approveMutation.mutate()}
                      disabled={
                        !request.financialVerifiedAt ||
                        approveMutation.isPending ||
                        rejectMutation.isPending
                      }
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<X className="h-4 w-4" />}
                      onClick={() => setRejectOpen(true)}
                      disabled={
                        approveMutation.isPending || rejectMutation.isPending
                      }
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Reject
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
                      Request details
                    </h2>
                  </div>
                  <dl className="p-6 space-y-4">
                    <DetailRow
                      icon={Building2}
                      label="Institution name"
                      value={request.institutionName}
                    />
                    <DetailRow label="Slug" value={request.slug} />
                    <DetailRow
                      icon={ClipboardList}
                      label="Deployment mode"
                      value={
                        MODE_LABELS[request.deploymentMode] ??
                        request.deploymentMode
                      }
                    />
                    <DetailRow
                      icon={Calendar}
                      label="Submitted"
                      value={new Date(request.createdAt).toLocaleString(
                        undefined,
                        { dateStyle: "medium", timeStyle: "short" }
                      )}
                    />
                    {request.approvedAt && (
                      <DetailRow
                        icon={CheckCircle}
                        label="Approved at"
                        value={new Date(request.approvedAt).toLocaleString(
                          undefined,
                          { dateStyle: "medium", timeStyle: "short" }
                        )}
                      />
                    )}
                    {request.rejectedAt && (
                      <>
                        <DetailRow
                          icon={X}
                          label="Rejected at"
                          value={new Date(request.rejectedAt).toLocaleString(
                            undefined,
                            { dateStyle: "medium", timeStyle: "short" }
                          )}
                        />
                        {request.rejectionReason && (
                          <DetailRow
                            icon={FileText}
                            label="Rejection reason"
                            value={request.rejectionReason}
                          />
                        )}
                      </>
                    )}
                    {request.tenant && (
                      <DetailRow
                        icon={FileText}
                        label="Terms & conditions"
                        value={
                          request.tenant.termsAcceptedAt
                            ? `Accepted on ${new Date(request.tenant.termsAcceptedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                            : "Not yet accepted"
                        }
                      />
                    )}
                    {request.status === "PENDING" && request.termsAcceptedAt && (
                      <DetailRow
                        icon={FileText}
                        label="Terms (quotation link)"
                        value={`Accepted on ${new Date(request.termsAcceptedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                      />
                    )}
                    {request.termsAcceptUrl && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                          Institution terms link
                        </p>
                        <p className="text-sm text-slate-400 break-all mb-2">
                          {request.termsAcceptUrl}
                        </p>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            navigator.clipboard.writeText(request.termsAcceptUrl!);
                            toast.success("Terms link copied to clipboard");
                          }}
                          sx={{
                            color: "primary.main",
                            borderColor: "primary.main",
                            textTransform: "none",
                            fontWeight: 600,
                          }}
                        >
                          Copy terms acceptance link
                        </Button>
                      </div>
                    )}
                    {request.termsQuotationUrl && !request.termsAcceptUrl && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                          Terms link (quotation / invoice email)
                        </p>
                        <p className="text-sm text-slate-400 break-all mb-2">
                          {request.termsQuotationUrl}
                        </p>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            navigator.clipboard.writeText(request.termsQuotationUrl);
                            toast.success("Terms link copied to clipboard");
                          }}
                          sx={{
                            color: "primary.main",
                            borderColor: "primary.main",
                            textTransform: "none",
                            fontWeight: 600,
                          }}
                        >
                          Copy terms link
                        </Button>
                      </div>
                    )}
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
                      Contact & usage
                    </h2>
                  </div>
                  <dl className="p-6 space-y-4">
                    <DetailRow
                      icon={User}
                      label="Contact person"
                      value={request.contactPerson}
                    />
                    <DetailRow
                      icon={Mail}
                      label="Contact email"
                      value={request.contactEmail}
                    />
                    <DetailRow
                      icon={Phone}
                      label="Phone"
                      value={request.phone ?? "—"}
                    />
                    <DetailRow
                      icon={Globe}
                      label="Country"
                      value={request.country}
                    />
                    <DetailRow
                      icon={Globe}
                      label="Website"
                      value={request.website ?? "—"}
                    />
                    <DetailRow
                      icon={Users}
                      label="Approx. students"
                      value={
                        request.approxStudents != null
                          ? String(request.approxStudents)
                          : "—"
                      }
                    />
                  </dl>
                </motion.section>
              </div>

              {/* Address */}
              {(request.addressLine1 ||
                request.addressCity ||
                request.addressStateRegion ||
                request.addressPostalCode) && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="rounded-2xl glass-card border border-white/10 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-slate-400" />
                    <h2 className="font-display text-lg font-semibold text-white">
                      Full address
                    </h2>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-white whitespace-pre-line">
                      {[
                        request.addressLine1,
                        request.addressLine2,
                        [
                          request.addressCity,
                          request.addressStateRegion,
                          request.addressPostalCode,
                        ]
                          .filter(Boolean)
                          .join(", "),
                        request.country,
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    </p>
                  </div>
                </motion.section>
              )}

              {/* Institution profile & due diligence */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl glass-card border border-white/10 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                  <Award className="h-5 w-5 text-slate-400" />
                  <h2 className="font-display text-lg font-semibold text-white">
                    Institution profile & due diligence
                  </h2>
                </div>
                <dl className="p-6 space-y-4 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <DetailRow
                    label="Year founded"
                    value={request.yearFounded != null ? String(request.yearFounded) : "—"}
                  />
                  <DetailRow
                    label="Institution type"
                    value={request.institutionType ?? "—"}
                  />
                  <DetailRow
                    label="Legal entity name"
                    value={request.legalEntityName ?? "—"}
                  />
                  <DetailRow
                    label="Tax ID / registration number"
                    value={request.taxIdOrRegistrationNumber ?? "—"}
                  />
                  <DetailRow
                    icon={Award}
                    label="Accreditation status"
                    value={request.accreditationStatus ?? "—"}
                  />
                  <DetailRow
                    label="Accrediting body"
                    value={request.accreditationBody ?? "—"}
                  />
                  {request.accreditationCertificateUrl && (
                    <div className="flex gap-3 md:col-span-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Accreditation certificate
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium">
                          <a
                            href={request.accreditationCertificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neon-cyan hover:underline break-all"
                          >
                            {request.accreditationCertificateUrl}
                          </a>
                        </dd>
                      </div>
                    </div>
                  )}
                  <DetailRow
                    label="Number of campuses"
                    value={
                      request.numberOfCampuses != null
                        ? String(request.numberOfCampuses)
                        : "—"
                    }
                  />
                </dl>
                {request.missionOrDescription && (
                  <div className="px-6 pb-6 pt-0">
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
                      Mission / description
                    </dt>
                    <dd className="text-sm text-white whitespace-pre-wrap">
                      {request.missionOrDescription}
                    </dd>
                  </div>
                )}
              </motion.section>
            </>
          ) : null}
        </div>

        {/* Reject confirmation */}
        <Dialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
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
          {request && (
            <>
              <DialogTitle className="font-display">
                Reject onboarding request
              </DialogTitle>
              <DialogContent>
                <p className="text-slate-300 text-sm mb-4">
                  Reject request for{" "}
                  <strong className="text-white">
                    {request.institutionName}
                  </strong>
                  ? Please provide a reason so the institution can be informed.
                </p>
                <TextField
                  fullWidth
                  required
                  label="Reason for rejection"
                  placeholder="e.g. Missing documentation, does not meet criteria…"
                  multiline
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                    "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setRejectOpen(false)}
                  sx={{ color: "rgba(226,232,240,0.8)" }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => rejectMutation.mutate(rejectReason)}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                >
                  {rejectMutation.isPending ? "Rejecting…" : "Reject"}
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
              placeholder="e.g. Follow-up on your onboarding request"
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
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
        <dd className="mt-0.5 text-sm font-medium text-white">{value}</dd>
      </div>
    </div>
  );
}
