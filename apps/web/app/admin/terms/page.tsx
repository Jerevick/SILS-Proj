"use client";

import Link from "next/link";
import { AdminShell } from "../components/admin-shell";
import { TERMS_MODE_LABELS, type TermsMode } from "@/lib/terms-content";
import { FileText } from "lucide-react";

const MODES: TermsMode[] = ["sis", "lms", "hybrid"];

export default function AdminTermsPage() {
  return (
    <AdminShell activeNav="terms">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-slate-400 mt-1">
            Institution-facing terms by deployment mode. New institutions must accept the terms applicable to their mode before accessing the platform.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <Link
              key={mode}
              href={`/terms/${mode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-white/10 bg-space-900/80 p-6 flex flex-col gap-3 hover:border-neon-cyan/30 hover:bg-neon-cyan/5 transition-colors group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan group-hover:bg-neon-cyan/30 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                {TERMS_MODE_LABELS[mode]}
              </h2>
              <p className="text-sm text-slate-400 flex-1">
                {mode === "sis" && "Terms for SIS-only deployment (student information system)."}
                {mode === "lms" && "Terms for LMS-only deployment (learning management system)."}
                {mode === "hybrid" && "Terms for Hybrid deployment (SIS + LMS)."}
              </p>
              <span className="text-sm font-medium text-neon-cyan group-hover:underline">
                View terms →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
