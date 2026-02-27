"use client";

import { AdminShell } from "../components/admin-shell";
import { Activity } from "lucide-react";

export default function AdminHealthPage() {
  return (
    <AdminShell activeNav="health">
      <div className="rounded-xl glass-card border border-white/10 p-8 text-center">
        <Activity className="mx-auto h-12 w-12 text-neon-cyan/60 mb-4" />
        <h1 className="font-display text-xl font-semibold text-white mb-2">System Health</h1>
        <p className="text-slate-400 text-sm">Coming soon. Service status and health metrics.</p>
      </div>
    </AdminShell>
  );
}
