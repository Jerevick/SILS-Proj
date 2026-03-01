"use client";

/**
 * Phase 21: Platform admin — notification templates info.
 * Templates are managed per-tenant; tenant admins use (app)/notifications/templates.
 * This page directs platform admins to institution context for template management.
 */

import Link from "next/link";
import { FileText, Building2 } from "lucide-react";
import { AdminShell } from "../../components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminNotificationTemplatesPage() {
  return (
    <AdminShell activeNav="settings">
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Notification templates
        </h1>
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <FileText className="h-5 w-5 text-neon-cyan" />
              Per-institution templates
            </CardTitle>
            <p className="text-slate-400 text-sm">
              Notification templates (email, SMS, push, in-app, WhatsApp) are configured per institution (tenant).
              To create or edit templates, sign in to that institution as an Owner or Admin and go to{" "}
              <strong className="text-slate-300">Notifications → Templates</strong>.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-white/20 text-slate-300" asChild>
              <Link href="/admin/institutions">
                <Building2 className="h-4 w-4 mr-2" />
                View institutions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
