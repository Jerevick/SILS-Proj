"use client";

/**
 * Payment history — all payments for the tenant.
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CreditCard, DollarSign } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useMe } from "@/hooks/use-me";
import { canAccessFinance } from "@/lib/finance-auth";

type PaymentRow = {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  method: string;
  transactionId: string | null;
  date: string;
  createdAt: string;
};

async function fetchPayments(): Promise<PaymentRow[]> {
  const res = await fetch("/api/finance/payments");
  if (!res.ok) throw new Error("Failed to fetch payments");
  const data = await res.json();
  return data.payments ?? [];
}

export default function FinancePaymentsPage() {
  const { data: me } = useMe();
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["finance", "payments"],
    queryFn: fetchPayments,
  });

  const canAccess = me?.kind === "tenant" && canAccessFinance(me.role);

  const columns: GridColDef<PaymentRow>[] = [
    {
      field: "id",
      headerName: "Payment",
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
    { field: "method", headerName: "Method", width: 100 },
    {
      field: "date",
      headerName: "Date",
      width: 140,
      valueFormatter: (v) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      field: "transactionId",
      headerName: "Transaction ID",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <span className="font-mono text-slate-400 text-xs truncate max-w-[200px] block">
          {params.value ?? "—"}
        </span>
      ),
    },
  ];

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view payments.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-6 h-6 text-emerald-400" />
        <h1 className="font-display text-xl font-semibold text-white">Payment history</h1>
      </div>
      <p className="text-slate-400 mb-6">
        All recorded payments (Stripe and manual). Receipts are sent when Stripe webhook confirms payment.
      </p>
      <DashboardDataGrid<PaymentRow>
        columns={columns}
        rows={payments}
        getRowId={(row) => row.id}
        pageSize={10}
      />
      {isLoading && (
        <p className="text-slate-500 text-sm mt-2">Loading payments…</p>
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
