"use client";

import { AdminShell } from "../components/admin-shell";
import { BarChart3 } from "lucide-react";

export default function AdminAnalyticsPage() {
  return (
    <AdminShell activeNav="analytics">
      <div className="rounded-xl glass-card border border-white/10 p-8 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-neon-cyan/60 mb-4" />
        <h1 className="font-display text-xl font-semibold text-white mb-2">Analytics & Insights</h1>
        <p className="text-slate-400 text-sm">Coming soon. Platform-wide analytics and reports.</p>
      </div>
    </AdminShell>
  );
}
