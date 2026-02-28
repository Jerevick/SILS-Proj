"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Typography } from "@mui/material";
import { AdminShell } from "../components/admin-shell";
import { AdminDataGrid, type GridColDef, type GridRenderCellParams } from "@/components/admin/data-grid";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Send,
  DollarSign,
  Building2,
  FileText,
  AlertTriangle,
  Receipt,
  Settings,
  TrendingUp,
  Calendar,
  Banknote,
  ArrowRight,
  ClipboardList,
  Printer,
  RotateCcw,
} from "lucide-react";
import {
  onboardingRequestsResponseSchema,
  institutionsResponseSchema,
  type OnboardingRequestRowSchema,
  type InstitutionRowSchema,
} from "@/lib/admin-schemas";

// ----- Types -----
type OnboardingRequestRow = OnboardingRequestRowSchema;

type InstitutionRow = InstitutionRowSchema;

type FinanceSettings = {
  pricingPlans: {
    sis: { onboardingFee: string; amount: string; perStudentAmount: string; currency: string; period: string };
    lms: { onboardingFee: string; amount: string; perStudentAmount: string; currency: string; period: string };
    hybrid: { onboardingFee: string; amount: string; perStudentAmount: string; currency: string; period: string };
  };
  paymentTerms: { defaultTerms: string; dueDays: number; latePolicy: string };
  bankDetails: { bankName: string; bban: string; swift: string; accountMasked: string; referenceFormat: string; instructions: string };
  taxCompliance: { taxId: string; vatNumber: string; invoicePrefix: string; nextNumber: number };
};

async function fetchRequests(): Promise<OnboardingRequestRow[]> {
  const res = await fetch("/api/onboarding/requests");
  if (!res.ok) throw new Error("Failed to fetch requests");
  const data = await res.json();
  const parsed = onboardingRequestsResponseSchema.parse(data);
  return parsed as OnboardingRequestRow[];
}

async function fetchInstitutions(): Promise<InstitutionRow[]> {
  const res = await fetch("/api/admin/institutions");
  if (!res.ok) throw new Error("Failed to fetch institutions");
  const data = await res.json();
  return institutionsResponseSchema.parse(data) as InstitutionRow[];
}

async function sendQuotation(requestId: string) {
  const res = await fetch(`/api/onboarding/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotationSent: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to send quotation");
  return data;
}

async function voidQuotation(requestId: string) {
  const res = await fetch(`/api/onboarding/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voidQuotation: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to void quotation");
  return data;
}

async function fetchFinanceSettings(): Promise<FinanceSettings> {
  const res = await fetch("/api/admin/finance-settings");
  if (!res.ok) throw new Error("Failed to fetch finance settings");
  const data = await res.json();
  return {
    pricingPlans: {
      sis: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual", ...data.pricingPlans?.sis },
      lms: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual", ...data.pricingPlans?.lms },
      hybrid: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual", ...data.pricingPlans?.hybrid },
    },
    paymentTerms: { defaultTerms: "Net 30", dueDays: 30, latePolicy: "", ...data.paymentTerms },
    bankDetails: (() => {
      const raw = data.bankDetails ?? {};
      return {
        bankName: String(raw.bankName ?? ""),
        bban: String(raw.bban ?? ""),
        swift: String(raw.swift ?? ""),
        accountMasked: String(raw.accountMasked ?? ""),
        referenceFormat: String(raw.referenceFormat ?? "INV-{institution}-{year}"),
        instructions: String(raw.instructions ?? ""),
      };
    })(),
    taxCompliance: {
      taxId: "",
      vatNumber: "",
      invoicePrefix: "SILS",
      nextNumber: 1,
      ...data.taxCompliance,
    },
  };
}

async function patchFinanceSettings(payload: Partial<FinanceSettings>) {
  const res = await fetch("/api/admin/finance-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Failed to update");
  }
  const json = await res.json();
  return json as { ok: boolean; settings?: FinanceSettings };
}

const TAB_ORDER = [
  "overview",
  "pipeline",
  "institutions",
  "quotations",
  "verification",
  "overdue",
  "settings",
] as const;
type TabKey = (typeof TAB_ORDER)[number];

const DEFAULT_FINANCE_FORM: FinanceSettings = {
  pricingPlans: {
    sis: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    lms: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    hybrid: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
  },
  paymentTerms: { defaultTerms: "Net 30", dueDays: 30, latePolicy: "" },
  bankDetails: { bankName: "", bban: "", swift: "", accountMasked: "", referenceFormat: "INV-{institution}-{year}", instructions: "" },
  taxCompliance: { taxId: "", vatNumber: "", invoicePrefix: "SILS", nextNumber: 1 },
};

export default function AdminFinancePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");
  const [sendQuotationModal, setSendQuotationModal] = useState<OnboardingRequestRow | null>(null);
  const [voidQuotationModal, setVoidQuotationModal] = useState<OnboardingRequestRow | null>(null);

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["onboarding-requests"],
    queryFn: fetchRequests,
  });
  const { data: institutions = [], isLoading: institutionsLoading } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: fetchInstitutions,
  });

  const { data: financeSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-finance-settings"],
    queryFn: fetchFinanceSettings,
    enabled: tab === "settings" || Boolean(sendQuotationModal),
    refetchOnMount: "always",
    staleTime: 0,
  });

  const settingsPatchMutation = useMutation({
    mutationFn: patchFinanceSettings,
    onSuccess: (result) => {
      if (result.settings) {
        queryClient.setQueryData(["admin-finance-settings"], result.settings);
        setSettingsForm(result.settings);
        if (result.settings.bankDetails) {
          setBankDetailsForm(result.settings.bankDetails);
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ["admin-finance-settings"] });
      }
      toast.success("Settings saved");
    },
    onError: (err) => toast.error("Failed to save", { description: err.message }),
  });

  const sendQuotationMutation = useMutation({
    mutationFn: sendQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      setSendQuotationModal(null);
      toast.success("Quotation email sent to institution contact");
    },
    onError: (err) => {
      toast.error("Failed to send quotation", { description: err.message });
      setSendQuotationModal(null);
    },
  });

  const voidQuotationMutation = useMutation({
    mutationFn: voidQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-requests"] });
      setVoidQuotationModal(null);
      toast.success("Quotation voided. You can send a new one.");
    },
    onError: (err) => {
      toast.error("Failed to void quotation", { description: err.message });
      setVoidQuotationModal(null);
    },
  });

  const [settingsForm, setSettingsForm] = useState<FinanceSettings | null>(null);
  const [bankDetailsForm, setBankDetailsForm] = useState<FinanceSettings["bankDetails"]>(DEFAULT_FINANCE_FORM.bankDetails);

  React.useEffect(() => {
    if (tab === "settings" && !settingsLoading && financeSettings) {
      setSettingsForm(financeSettings);
    }
  }, [tab, settingsLoading, financeSettings]);

  React.useEffect(() => {
    if (financeSettings?.bankDetails) {
      setBankDetailsForm(financeSettings.bankDetails);
    }
  }, [financeSettings?.bankDetails]);

  // Use loaded data when form state not yet synced so saved bank details etc. show immediately
  const displaySettings: FinanceSettings = settingsForm ?? financeSettings ?? DEFAULT_FINANCE_FORM;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const quotationSent = pendingRequests.filter((r) => r.quotationSentAt);
  const paymentVerifiedPending = pendingRequests.filter((r) => r.financialVerifiedAt);
  const awaitingPayment = quotationSent.length - paymentVerifiedPending.length;
  const allQuotationsLog = requests.filter((r) => r.quotationSentAt != null);
  const paymentVerificationLog = requests.filter((r) => r.financialVerifiedAt != null);
  const institutionsWithPayment = institutions.filter((r) => r.paymentVerifiedAt != null);

  // ----- Grid columns -----
  const pipelineColumns: GridColDef<OnboardingRequestRow>[] = [
    {
      field: "institutionName",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => (
        <Link
          href={`/admin/requests/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.institutionName}
        </Link>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 72,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => {
        const row = params.row;
        const needsQuotation = !row.quotationSentAt;
        const canVoidQuotation = row.quotationSentAt && row.status === "PENDING";
        const actions = [
          ...(needsQuotation
            ? [
                {
                  label: "Send quotation",
                  icon: Send,
                  onClick: () => setSendQuotationModal(row),
                },
              ]
            : []),
          ...(canVoidQuotation
            ? [
                {
                  label: "Void quotation",
                  icon: RotateCcw,
                  onClick: () => setVoidQuotationModal(row),
                  variant: "destructive" as const,
                },
              ]
            : []),
        ];
        return <ActionsCell row={row} actions={actions} />;
      },
    },
    { field: "contactPerson", headerName: "Contact", width: 120 },
    { field: "contactEmail", headerName: "Email", width: 180 },
    { field: "deploymentMode", headerName: "Mode", width: 80 },
    {
      field: "quotationSentAt",
      headerName: "Quotation sent",
      width: 130,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) =>
        params.value ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Send className="h-4 w-4" />
            {new Date(params.value as string).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-amber-400">Pending</span>
        ),
    },
    {
      field: "financialVerifiedAt",
      headerName: "Payment received",
      width: 130,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) =>
        params.value ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            Yes
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-500">
            <XCircle className="h-4 w-4" />
            No
          </span>
        ),
    },
    {
      field: "createdAt",
      headerName: "Submitted",
      width: 110,
      valueFormatter: (_, row) =>
        new Date(row.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
  ];

  const institutionColumns: GridColDef<InstitutionRow>[] = [
    {
      field: "name",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) => (
        <Link
          href={`/admin/institutions/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.name}
        </Link>
      ),
    },
    { field: "slug", headerName: "Slug", width: 120 },
    { field: "deploymentMode", headerName: "Mode", width: 90 },
    {
      field: "paymentVerifiedAt",
      headerName: "Payment verified",
      width: 140,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) =>
        params.value ? (
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            {new Date(params.value as string).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params: GridRenderCellParams<InstitutionRow>) => (
        <span
          className={
            params.value === "ACTIVE"
              ? "text-emerald-400"
              : "text-amber-400"
          }
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "_count",
      headerName: "Users / Courses",
      width: 120,
      valueFormatter: (_, row) => `${row._count?.users ?? 0} / ${row._count?.courses ?? 0}`,
    },
  ];

  const quotationLogColumns: GridColDef<OnboardingRequestRow>[] = [
    {
      field: "institutionName",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => (
        <Link
          href={`/admin/requests/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.institutionName}
        </Link>
      ),
    },
    { field: "contactEmail", headerName: "Sent to", width: 200 },
    {
      field: "quotationSentAt",
      headerName: "Sent date",
      width: 130,
      valueFormatter: (_, row) =>
        row.quotationSentAt
          ? new Date(row.quotationSentAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
    },
    {
      field: "quotationInvoiceNumber",
      headerName: "Invoice #",
      width: 120,
      valueFormatter: (_: unknown, row: OnboardingRequestRow) => row.quotationInvoiceNumber ?? "—",
    },
    {
      field: "voidQuotation",
      headerName: "Actions",
      width: 72,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => {
        const row = params.row;
        const canVoid = row.quotationSentAt && row.status === "PENDING";
        const actions = [
          ...(row.quotationSentAt
            ? [
                {
                  label: "Print PDF",
                  icon: Printer,
                  onClick: () => window.open(`/admin/finance/invoice/${row.id}`, "_blank"),
                },
              ]
            : []),
          ...(canVoid
            ? [
                {
                  label: "Void quotation",
                  icon: RotateCcw,
                  onClick: () => setVoidQuotationModal(row),
                  variant: "destructive" as const,
                },
              ]
            : []),
        ];
        if (actions.length === 0) return <span className="text-slate-500">—</span>;
        return <ActionsCell row={row} actions={actions} />;
      },
    },
    {
      field: "status",
      headerName: "Request status",
      width: 120,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => (
        <span
          className={
            params.value === "APPROVED"
              ? "text-emerald-400"
              : params.value === "REJECTED"
                ? "text-red-400"
                : "text-amber-400"
          }
        >
          {params.value}
        </span>
      ),
    },
  ];

  const verificationLogColumns: GridColDef<OnboardingRequestRow>[] = [
    {
      field: "institutionName",
      headerName: "Institution",
      flex: 1,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => (
        <Link
          href={`/admin/requests/${params.row.id}`}
          className="font-medium text-neon-cyan hover:underline"
        >
          {params.row.institutionName}
        </Link>
      ),
    },
    {
      field: "financialVerifiedAt",
      headerName: "Verified at",
      width: 160,
      valueFormatter: (_, row) =>
        row.financialVerifiedAt
          ? new Date(row.financialVerifiedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
    },
    {
      field: "financialVerifiedBy",
      headerName: "Verified by",
      width: 140,
      valueFormatter: (_, row) =>
        row.financialVerifiedBy ? `User ${String(row.financialVerifiedBy).slice(0, 12)}…` : "—",
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params: GridRenderCellParams<OnboardingRequestRow>) => (
        <span
          className={
            params.value === "APPROVED"
              ? "text-emerald-400"
              : params.value === "REJECTED"
                ? "text-red-400"
                : "text-amber-400"
          }
        >
          {params.value}
        </span>
      ),
    },
  ];

  return (
    <AdminShell activeNav="finance">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">
              Finance
            </h1>
            <p className="text-slate-400 mt-1">
              Manage institutions’ billing, onboarding payments, quotations, verification, and finance settings.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 border-b border-white/10 rounded-none bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <ArrowRight className="h-4 w-4 mr-2" />
              Onboarding pipeline
            </TabsTrigger>
            <TabsTrigger value="institutions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <Building2 className="h-4 w-4 mr-2" />
              Institutions & billing
            </TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <Receipt className="h-4 w-4 mr-2" />
              Quotations & invoices
            </TabsTrigger>
            <TabsTrigger value="verification" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <CheckCircle className="h-4 w-4 mr-2" />
              Payment verification log
            </TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Overdue & actions
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-neon-cyan data-[state=active]:bg-transparent data-[state=active]:text-neon-cyan text-slate-400">
              <Settings className="h-4 w-4 mr-2" />
              Finance settings
            </TabsTrigger>
          </TabsList>

          {/* ----- Overview ----- */}
          <TabsContent value="overview" className="mt-0">
            <section className="space-y-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-white/10 bg-space-900/80 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">Total institutions</span>
                    <Building2 className="h-5 w-5 text-neon-cyan/80" />
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">{institutions.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Active tenants on platform</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-space-900/80 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">Pending pipeline</span>
                    <ClipboardList className="h-5 w-5 text-amber-400/80" />
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">{pendingRequests.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {quotationSent.length} quotation sent, {awaitingPayment} awaiting payment
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-space-900/80 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">Payment verified</span>
                    <CheckCircle className="h-5 w-5 text-emerald-400/80" />
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">{institutionsWithPayment.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Institutions with completed onboarding payment</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-space-900/80 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">Quotations sent</span>
                    <Send className="h-5 w-5 text-neon-cyan/80" />
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">{allQuotationsLog.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Total quotation/invoice emails sent</p>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-space-900/80 p-6">
                <h3 className="font-display text-lg font-semibold text-white mb-2">Quick actions</h3>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/requests"
                    className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 text-neon-cyan px-4 py-2.5 text-sm font-medium hover:bg-neon-cyan/30 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Onboarding requests
                  </Link>
                  <Link
                    href="/admin/institutions"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 text-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    <Building2 className="h-4 w-4" />
                    Institutions
                  </Link>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* ----- Onboarding pipeline ----- */}
          <TabsContent value="pipeline" className="mt-0">
            <section className="pt-4">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Pending requests — quotation & payment
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Send quotation from here. Payment is verified automatically when the institution pays online (Stripe). Approve requests from the request detail page once payment is verified.
                  </p>
                </div>
                <AdminDataGrid<OnboardingRequestRow>
                    rows={pendingRequests}
                    columns={pipelineColumns}
                    getRowId={(row) => row.id}
                    loading={requestsLoading}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                    disableRowSelectionOnClick
                    height={380}
                    slots={{
                      noRowsOverlay: () => (
                        <Typography sx={{ color: "text.secondary", p: 2 }}>
                          No pending onboarding requests
                        </Typography>
                      ),
                    }}
                  />
              </div>
            </section>
          </TabsContent>

          {/* ----- Institutions & billing ----- */}
          <TabsContent value="institutions" className="mt-0">
            <section className="pt-4">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Institutions — billing & payment status
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    All institutions. Payment verified date is set automatically when the institution pays online (Stripe), or at approval for legacy records.
                  </p>
                </div>
                <AdminDataGrid<InstitutionRow>
                    rows={institutions}
                    columns={institutionColumns}
                    getRowId={(row) => row.id}
                    loading={institutionsLoading}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                    disableRowSelectionOnClick
                    height={380}
                    slots={{
                      noRowsOverlay: () => (
                        <Typography sx={{ color: "text.secondary", p: 2 }}>
                          No institutions yet
                        </Typography>
                      ),
                    }}
                  />
              </div>
            </section>
          </TabsContent>

          {/* ----- Quotations & invoices ----- */}
          <TabsContent value="quotations" className="mt-0">
            <section className="pt-4">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Quotations & invoices sent
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Log of all onboarding quotations/invoices sent to institutions. Use request detail to resend or manage.
                  </p>
                </div>
                <AdminDataGrid<OnboardingRequestRow>
                    rows={allQuotationsLog}
                    columns={quotationLogColumns}
                    getRowId={(row) => row.id}
                    loading={requestsLoading}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                    disableRowSelectionOnClick
                    height={380}
                    slots={{
                      noRowsOverlay: () => (
                        <Typography sx={{ color: "text.secondary", p: 2 }}>
                          No quotations sent yet
                        </Typography>
                      ),
                    }}
                  />
              </div>
            </section>
          </TabsContent>

          {/* ----- Payment verification log ----- */}
          <TabsContent value="verification" className="mt-0">
            <section className="pt-4">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Payment verification log
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    All records where payment was verified (automatically when the institution pays online, for onboarding requests and institutions).
                  </p>
                </div>
                <AdminDataGrid<OnboardingRequestRow>
                    rows={paymentVerificationLog}
                    columns={verificationLogColumns}
                    getRowId={(row) => row.id}
                    loading={requestsLoading}
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                    disableRowSelectionOnClick
                    height={380}
                    slots={{
                      noRowsOverlay: () => (
                        <Typography sx={{ color: "text.secondary", p: 2 }}>
                          No payment verifications yet
                        </Typography>
                      ),
                    }}
                  />
              </div>
            </section>
          </TabsContent>

          {/* ----- Overdue & actions ----- */}
          <TabsContent value="overdue" className="mt-0">
            <section className="pt-4 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-space-900/80 p-8">
                <div className="flex items-center gap-3 text-amber-400 mb-2">
                  <AlertTriangle className="h-6 w-6" />
                  <h2 className="font-display text-lg font-semibold text-white">
                    Overdue payments & suspension
                  </h2>
                </div>
                <p className="text-slate-400 text-sm max-w-2xl">
                  Track subscription renewals and overdue payments here. When you add subscription end dates and billing cycles, you can list institutions due for renewal or overdue, and trigger suspension for non-payment from this section.
                </p>
                <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 max-w-xl">
                  <p className="text-sm text-amber-200">
                    <strong>Coming soon:</strong> Subscription renewal dates, overdue flags, and one-click suspend for non-payment. Configure pricing plans and payment terms in Finance settings.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-space-900/80 p-6">
                <h3 className="font-display font-semibold text-white mb-2">Manual actions</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Until automated overdue handling is available, you can suspend an institution from the institution detail page if needed for non-payment.
                </p>
                <Link
                  href="/admin/institutions"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 text-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                  Go to institutions
                </Link>
              </div>
            </section>
          </TabsContent>

          {/* ----- Finance settings ----- */}
          <TabsContent value="settings" className="mt-0">
            <section className="pt-4 space-y-6">
              {settingsLoading ? (
                <p className="text-slate-400">Loading settings…</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pricing plans */}
                  <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-neon-cyan" />
                      <h3 className="font-display font-semibold text-white">Pricing plans</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      <p className="text-slate-400 text-sm">
                        Onboarding is a one-off payment at sign-up. For recurring revenue, the institution chooses either a fixed annual payment or pay per active student user.
                      </p>
                      {settingsForm && (
                        <>
                          {(["sis", "lms", "hybrid"] as const).map((plan) => (
                            <div
                              key={plan}
                              className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
                            >
                              <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                                <p className="font-semibold text-slate-200 uppercase tracking-wider">
                                  {plan}
                                </p>
                              </div>
                              <div className="p-4 space-y-5">
                                {/* Onboarding (one-time) */}
                                <div>
                                  <Label className="text-slate-400 font-semibold uppercase tracking-wide text-xs">Onboarding (one-time)</Label>
                                  <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <div className="w-[140px]">
                                      <Input
                                        type="text"
                                        placeholder="e.g. 2000"
                                        value={settingsForm.pricingPlans[plan].onboardingFee}
                                        onChange={(e) =>
                                          setSettingsForm((prev) =>
                                            prev ? { ...prev, pricingPlans: { ...prev.pricingPlans, [plan]: { ...prev.pricingPlans[plan], onboardingFee: e.target.value } } } : prev
                                          )
                                        }
                                        className="h-9 border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500"
                                      />
                                    </div>
                                    <Select
                                      value={settingsForm.pricingPlans[plan].currency}
                                      onValueChange={(value) =>
                                        setSettingsForm((prev) =>
                                          prev ? { ...prev, pricingPlans: { ...prev.pricingPlans, [plan]: { ...prev.pricingPlans[plan], currency: value } } } : prev
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-[100px] h-9 border-white/20 bg-transparent text-slate-200">
                                        <SelectValue placeholder="Currency" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Recurring: annual OR per active student */}
                                <div>
                                  <Label className="text-slate-400 font-semibold uppercase tracking-wide text-xs">Recurring (institution chooses one)</Label>
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
                                      <p className="text-slate-200 font-medium text-sm">Annual payment</p>
                                      <Input
                                        type="text"
                                        placeholder="e.g. 12000"
                                        value={settingsForm.pricingPlans[plan].amount}
                                        onChange={(e) =>
                                          setSettingsForm((prev) =>
                                            prev ? { ...prev, pricingPlans: { ...prev.pricingPlans, [plan]: { ...prev.pricingPlans[plan], amount: e.target.value } } } : prev
                                          )
                                        }
                                        className="h-9 border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500"
                                      />
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
                                      <p className="text-slate-200 font-medium text-sm">Pay per active student</p>
                                      <Input
                                        type="text"
                                        placeholder="e.g. 8.00"
                                        value={settingsForm.pricingPlans[plan].perStudentAmount}
                                        onChange={(e) =>
                                          setSettingsForm((prev) =>
                                            prev ? { ...prev, pricingPlans: { ...prev.pricingPlans, [plan]: { ...prev.pricingPlans[plan], perStudentAmount: e.target.value } } } : prev
                                          )
                                        }
                                        className="h-9 border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500"
                                      />
                                      <p className="text-xs text-slate-500">Charged per active student user</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="pt-2">
                            <Button
                              onClick={() => settingsPatchMutation.mutate({ pricingPlans: settingsForm.pricingPlans })}
                              disabled={settingsPatchMutation.isPending}
                              className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim font-semibold"
                            >
                              {settingsPatchMutation.isPending ? "Saving…" : "Save pricing plans"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Payment terms */}
                  <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-neon-cyan" />
                      <h3 className="font-display font-semibold text-white">Payment terms</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className="text-slate-400 text-sm">
                        Default payment terms, due date rules, and late payment policies.
                      </p>
                      {settingsForm && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Default terms (e.g. Net 30)</Label>
                            <Input
                              value={settingsForm.paymentTerms.defaultTerms}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev ? { ...prev, paymentTerms: { ...prev.paymentTerms, defaultTerms: e.target.value } } : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Due days</Label>
                            <Input
                              type="number"
                              min={0}
                              value={settingsForm.paymentTerms.dueDays}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev
                                    ? { ...prev, paymentTerms: { ...prev.paymentTerms, dueDays: parseInt(e.target.value, 10) || 0 } }
                                    : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Late payment policy</Label>
                            <Textarea
                              rows={2}
                              value={settingsForm.paymentTerms.latePolicy}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev ? { ...prev, paymentTerms: { ...prev.paymentTerms, latePolicy: e.target.value } } : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500 resize-none"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => settingsPatchMutation.mutate({ paymentTerms: settingsForm.paymentTerms })}
                            disabled={settingsPatchMutation.isPending}
                            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                          >
                            {settingsPatchMutation.isPending ? "Saving…" : "Save payment terms"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bank & payment details */}
                  <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <Banknote className="h-5 w-5 text-neon-cyan" />
                      <h3 className="font-display font-semibold text-white">Bank & payment details</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className="text-slate-400 text-sm">
                        Bank account, reference format for transfers, and payment instructions for quotations and invoices.
                      </p>
                      {settingsForm && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Bank name</Label>
                            <Input
                              value={bankDetailsForm.bankName}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, bankName: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">BBAN</Label>
                            <Input
                              placeholder="Basic Bank Account Number"
                              value={bankDetailsForm.bban}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, bban: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">SWIFT / BIC</Label>
                            <Input
                              placeholder="e.g. DEUTDEFF"
                              value={bankDetailsForm.swift}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, swift: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Account (masked, e.g. ****1234)</Label>
                            <Input
                              value={bankDetailsForm.accountMasked}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, accountMasked: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Reference format (e.g. INV-&#123;institution&#125;-&#123;year&#125;)</Label>
                            <Input
                              value={bankDetailsForm.referenceFormat}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, referenceFormat: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Payment instructions</Label>
                            <Textarea
                              rows={3}
                              value={bankDetailsForm.instructions}
                              onChange={(e) =>
                                setBankDetailsForm((prev) => ({ ...prev, instructions: e.target.value }))
                              }
                              className="border-white/20 bg-transparent text-slate-200 placeholder:text-slate-500 resize-none"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => settingsPatchMutation.mutate({ bankDetails: bankDetailsForm })}
                            disabled={settingsPatchMutation.isPending}
                            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                          >
                            {settingsPatchMutation.isPending ? "Saving…" : "Save bank details"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tax & compliance */}
                  <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-neon-cyan" />
                      <h3 className="font-display font-semibold text-white">Tax & compliance</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className="text-slate-400 text-sm">
                        Tax IDs, VAT, invoice numbering, and regional compliance for billing.
                      </p>
                      {settingsForm && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Tax ID</Label>
                            <Input
                              value={settingsForm.taxCompliance.taxId}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev ? { ...prev, taxCompliance: { ...prev.taxCompliance, taxId: e.target.value } } : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">VAT number</Label>
                            <Input
                              value={settingsForm.taxCompliance.vatNumber}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev ? { ...prev, taxCompliance: { ...prev.taxCompliance, vatNumber: e.target.value } } : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Invoice prefix</Label>
                            <Input
                              value={settingsForm.taxCompliance.invoicePrefix}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev ? { ...prev, taxCompliance: { ...prev.taxCompliance, invoicePrefix: e.target.value } } : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Next invoice number</Label>
                            <Input
                              type="number"
                              min={1}
                              value={settingsForm.taxCompliance.nextNumber}
                              onChange={(e) =>
                                setSettingsForm((prev) =>
                                  prev
                                    ? { ...prev, taxCompliance: { ...prev.taxCompliance, nextNumber: parseInt(e.target.value, 10) || 1 } }
                                    : prev
                                )
                              }
                              className="border-white/20 bg-transparent text-slate-200"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => settingsPatchMutation.mutate({ taxCompliance: settingsForm.taxCompliance })}
                            disabled={settingsPatchMutation.isPending}
                            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                          >
                            {settingsPatchMutation.isPending ? "Saving…" : "Save tax & compliance"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </TabsContent>

          {/* Send quotation verification (finance personnel) */}
          <Dialog
            open={Boolean(sendQuotationModal)}
            onOpenChange={(open) => {
              if (!open && !sendQuotationMutation.isPending) setSendQuotationModal(null);
            }}
          >
            <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
            {sendQuotationModal && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-white">Verify and send quotation</DialogTitle>
                </DialogHeader>
                <p className="text-slate-300 text-sm mb-2">
                  Sending quotation to: <strong className="text-white">{sendQuotationModal.institutionName}</strong>
                </p>
                <p className="text-slate-400 text-sm mb-4">{sendQuotationModal.contactEmail}</p>

                {settingsLoading ? (
                  <p className="text-slate-500 text-sm">Loading invoice…</p>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4 text-sm">
                    <div className="border-b border-white/10 pb-2">
                      <p className="text-slate-400 uppercase tracking-wide text-xs font-semibold">
                        Invoice / Quotation
                      </p>
                      <p className="text-white font-medium mt-0.5">
                        {sendQuotationModal.institutionName} — {sendQuotationModal.deploymentMode}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Invoice number:{" "}
                        <strong className="text-white">
                          {sendQuotationModal.quotationInvoiceNumber ??
                            (displaySettings.taxCompliance.invoicePrefix != null &&
                            displaySettings.taxCompliance.nextNumber != null
                              ? `${String(displaySettings.taxCompliance.invoicePrefix).trim() || "SILS"}-${String(displaySettings.taxCompliance.nextNumber).padStart(4, "0")}`
                              : "—")}
                        </strong>
                        {!sendQuotationModal.quotationInvoiceNumber &&
                          displaySettings.taxCompliance.nextNumber != null && (
                            <span className="text-slate-500"> (assigned when you send)</span>
                          )}
                      </p>
                    </div>

                    {(() => {
                      const planKey = sendQuotationModal.deploymentMode.toLowerCase() as "sis" | "lms" | "hybrid";
                      const plan = displaySettings.pricingPlans[planKey] ?? displaySettings.pricingPlans.sis;
                      const currency = plan.currency || "USD";
                      const formatAmount = (v: string) => (v ? `${currency} ${v}` : "—");

                      return (
                        <>
                          <div>
                            <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Onboarding fee (one-time)</p>
                            <p className="text-white font-medium">{formatAmount(plan.onboardingFee)}</p>
                          </div>

                          <div>
                            <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Payment terms</p>
                            <p className="text-slate-300">
                              {displaySettings.paymentTerms.defaultTerms || "—"}
                              {displaySettings.paymentTerms.dueDays ? `, due within ${displaySettings.paymentTerms.dueDays} days` : ""}
                            </p>
                            {displaySettings.paymentTerms.latePolicy && (
                              <p className="text-slate-500 text-xs mt-1">{displaySettings.paymentTerms.latePolicy}</p>
                            )}
                          </div>

                          <div>
                            <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Bank & payment details</p>
                            <div className="text-slate-300 space-y-0.5">
                              {displaySettings.bankDetails.bankName && <p>{displaySettings.bankDetails.bankName}</p>}
                              {displaySettings.bankDetails.bban && <p>BBAN: {displaySettings.bankDetails.bban}</p>}
                              {displaySettings.bankDetails.swift && <p>SWIFT/BIC: {displaySettings.bankDetails.swift}</p>}
                              {displaySettings.bankDetails.accountMasked && <p>Account: {displaySettings.bankDetails.accountMasked}</p>}
                              {displaySettings.bankDetails.referenceFormat && (
                                <p className="text-xs mt-1">
                                  Reference: {displaySettings.bankDetails.referenceFormat
                                    .replace("{institution}", sendQuotationModal.institutionName.replace(/\s+/g, "-").slice(0, 20))
                                    .replace("{year}", new Date().getFullYear().toString())}
                                </p>
                              )}
                              {displaySettings.bankDetails.instructions && (
                                <p className="text-slate-500 text-xs mt-2 whitespace-pre-wrap">{displaySettings.bankDetails.instructions}</p>
                              )}
                              {!displaySettings.bankDetails.bankName && !displaySettings.bankDetails.bban && !displaySettings.bankDetails.swift && (
                                <p className="text-amber-500/90 text-xs">Configure bank details in Finance settings.</p>
                              )}
                            </div>
                          </div>

                          {(displaySettings.taxCompliance.taxId || displaySettings.taxCompliance.vatNumber) && (
                            <div>
                              <p className="text-slate-500 uppercase tracking-wide text-xs mb-1">Tax / compliance</p>
                              <div className="text-slate-300 space-y-0.5">
                                {displaySettings.taxCompliance.taxId && <p>Tax ID: {displaySettings.taxCompliance.taxId}</p>}
                                {displaySettings.taxCompliance.vatNumber && <p>VAT: {displaySettings.taxCompliance.vatNumber}</p>}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                <p className="text-slate-400 text-sm mt-4">
                  This will record the quotation send date and send an email to the institution contact. Only finance personnel should perform this action.
                </p>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setSendQuotationModal(null)}
                    disabled={sendQuotationMutation.isPending}
                    className="text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <a
                    href={`/admin/finance/invoice/${sendQuotationModal.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 text-slate-300 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors no-underline"
                  >
                    <Printer className="h-4 w-4" />
                    Print / Save as PDF
                  </a>
                  <Button
                    onClick={() => sendQuotationMutation.mutate(sendQuotationModal.id)}
                    disabled={sendQuotationMutation.isPending || settingsLoading}
                    className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim font-semibold"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendQuotationMutation.isPending ? "Sending…" : "Confirm and send"}
                  </Button>
                </DialogFooter>
              </>
            )}
            </DialogContent>
          </Dialog>

          {/* Void quotation confirmation (finance personnel) */}
          <Dialog
            open={Boolean(voidQuotationModal)}
            onOpenChange={(open) => {
              if (!open && !voidQuotationMutation.isPending) setVoidQuotationModal(null);
            }}
          >
            <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
            {voidQuotationModal && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-amber-400">Void quotation / invoice</DialogTitle>
                </DialogHeader>
                <p className="text-slate-300 text-sm mb-2">
                  This will clear the sent quotation for: <strong className="text-white">{voidQuotationModal.institutionName}</strong>
                </p>
                <p className="text-slate-400 text-sm mb-2">
                  Invoice {voidQuotationModal.quotationInvoiceNumber ?? "—"} will be voided. The invoice link in the email will stop working.
                </p>
                <p className="text-slate-400 text-sm mb-4">
                  After voiding, you can send a new quotation (a new invoice number will be assigned). Only do this if the previous quotation was wrong or needs to be replaced.
                </p>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setVoidQuotationModal(null)}
                    disabled={voidQuotationMutation.isPending}
                    className="text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => voidQuotationMutation.mutate(voidQuotationModal.id)}
                    disabled={voidQuotationMutation.isPending}
                    className="bg-amber-500 text-space-900 hover:bg-amber-600 font-semibold"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {voidQuotationMutation.isPending ? "Voiding…" : "Void quotation"}
                  </Button>
                </DialogFooter>
              </>
            )}
            </DialogContent>
          </Dialog>
        </Tabs>
      </div>
    </AdminShell>
  );
}
