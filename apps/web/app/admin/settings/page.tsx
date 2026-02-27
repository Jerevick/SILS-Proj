"use client";

import { AdminShell } from "../components/admin-shell";
import { Settings } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <AdminShell activeNav="settings">
      <div className="rounded-xl glass-card border border-white/10 p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-neon-cyan/60 mb-4" />
        <h1 className="font-display text-xl font-semibold text-white mb-2">Settings</h1>
        <p className="text-slate-400 text-sm">Coming soon. Platform configuration.</p>
      </div>
    </AdminShell>
  );
}
