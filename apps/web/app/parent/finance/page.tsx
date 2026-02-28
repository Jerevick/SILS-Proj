"use client";

/**
 * Parent finance portal stub — view fees, invoices, and payments for linked students.
 * Full implementation would resolve parent → student(s) and scope data by student.
 */

import * as React from "react";
import Link from "next/link";
import { DollarSign, FileText, CreditCard } from "lucide-react";

export default function ParentFinancePage() {
  return (
    <div className="min-h-screen bg-space-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-amber-400" />
          <h1 className="font-display text-xl font-semibold text-white">Finance</h1>
        </div>
        <p className="text-slate-400 mb-8">
          View fees, invoices, and payment history for your linked students. This portal is read-only for parents and guardians.
        </p>

        <div className="grid gap-4">
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Invoices
            </h2>
            <p className="text-slate-400 text-sm">
              Invoices for your linked students will appear here. Pay online via the link in each invoice.
            </p>
            <p className="text-slate-500 text-xs mt-2">Coming soon: list of invoices by student.</p>
          </section>
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Payment history
            </h2>
            <p className="text-slate-400 text-sm">
              View past payments and download receipts.
            </p>
            <p className="text-slate-500 text-xs mt-2">Coming soon: payment history and receipts.</p>
          </section>
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-neon-cyan text-sm inline-flex items-center gap-1"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
