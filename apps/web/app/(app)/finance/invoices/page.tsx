"use client";

/**
 * Invoices list — generate invoice and payment status.
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, ExternalLink, DollarSign } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMe } from "@/hooks/use-me";
import { canAccessFinance } from "@/lib/finance-auth";

type InvoiceRow = {
  id: string;
  studentId: string;
  amount: number;
  dueDate: string;
  status: string;
  stripePaymentLinkUrl: string | null;
  payments: { id: string; amount: number; method: string; date: string }[];
  createdAt: string;
};

async function fetchInvoices(): Promise<InvoiceRow[]> {
  const res = await fetch("/api/finance/invoices");
  if (!res.ok) throw new Error("Failed to fetch invoices");
  const data = await res.json();
  return data.invoices ?? [];
}

export default function FinanceInvoicesPage() {
  const { data: me } = useMe();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: fetchInvoices,
  });

  const canAccess = me?.kind === "tenant" && canAccessFinance(me.role);

  const columns: GridColDef<InvoiceRow>[] = [
    {
      field: "id",
      headerName: "Invoice",
      width: 120,
      renderCell: (params) => (
        <span className="font-mono text-slate-300 text-sm">{params.value?.slice(0, 8)}…</span>
      ),
    },
    { field: "studentId", headerName: "Student ID", width: 140 },
    {
      field: "amount",
      headerName: "Amount",
      width: 110,
      valueFormatter: (v) => (v != null ? `$${Number(v).toFixed(2)}` : "—"),
    },
    {
      field: "dueDate",
      headerName: "Due date",
      width: 120,
      valueFormatter: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
    { field: "status", headerName: "Status", width: 100 },
    {
      field: "payments",
      headerName: "Payments",
      width: 100,
      valueGetter: (_, row) =>
        row.payments?.length
          ? `$${row.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0).toFixed(2)}`
          : "—",
    },
    {
      field: "payLink",
      headerName: "Pay link",
      width: 90,
      sortable: false,
      renderCell: (params) =>
        params.row.stripePaymentLinkUrl ? (
          <a
            href={params.row.stripePaymentLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-neon-cyan hover:underline text-sm"
          >
            <ExternalLink className="w-4 h-4" /> Pay
          </a>
        ) : (
          <span className="text-slate-500">—</span>
        ),
    },
  ];

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view invoices.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-6 h-6 text-cyan-400" />
        <h1 className="font-display text-xl font-semibold text-white">Invoices</h1>
      </div>
      <p className="text-slate-400 mb-6">
        Create invoices from Financial Aid or manually. Payment links open Stripe Checkout.
      </p>
      <DashboardDataGrid<InvoiceRow>
        columns={columns}
        rows={invoices}
        getRowId={(row) => row.id}
        pageSize={10}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading invoices…</p>
      )}
      <div className="mt-6">
        <Link
          href="/finance/dashboard"
          className="text-slate-400 hover:text-neon-cyan text-sm inline-flex items-center gap-1"
        >
          <DollarSign className="w-4 h-4" /> Back to Finance dashboard
        </Link>
      </div>
    </div>
  );
}
