"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RunFullSystemHealthCheck,
  type RunFullSystemHealthCheckResult,
} from "@/app/actions/monitoring-actions";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Brain,
  Database,
  Key,
  CreditCard,
  Server,
  Zap,
  Video,
} from "lucide-react";

const STATUS_ICONS = {
  ok: CheckCircle2,
  degraded: AlertCircle,
  error: XCircle,
  skipped: Server,
};

export default function MonitoringPage() {
  const [result, setResult] = useState<RunFullSystemHealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const runCheck = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await RunFullSystemHealthCheck({ logToSystem: true });
      setResult(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  if (loading && !result) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-neon-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dashboard"
              className="font-display text-lg font-bold text-white hover:text-neon-cyan transition-colors"
            >
              SILS
            </Link>
            <span className="text-slate-500">/</span>
            <h1 className="font-display text-xl font-bold text-white">
              Production Monitoring
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/ai/orchestrator"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-neon-cyan"
            >
              <Brain className="w-4 h-4" />
              Intelligence Hub
            </Link>
            <button
              onClick={() => runCheck(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary */}
        {result && (
          <div
            className={`rounded-xl border p-4 ${
              result.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-amber-500/10 border-amber-500/30 text-amber-200"
            }`}
          >
            <p className="font-medium">{result.summary}</p>
            <p className="text-sm opacity-80 mt-1">Checked at {result.timestamp}</p>
          </div>
        )}

        {/* Health checks */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-cyan" />
            System health
          </h2>
          <div className="grid gap-3">
            {result?.checks.map((check) => {
              const Icon = STATUS_ICONS[check.status];
              const color =
                check.status === "ok"
                  ? "text-emerald-400"
                  : check.status === "error"
                    ? "text-red-400"
                    : check.status === "degraded"
                      ? "text-amber-400"
                      : "text-slate-500";
              return (
                <div
                  key={check.name}
                  className="flex items-center justify-between rounded-xl glass border border-white/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <div>
                      <p className="font-medium text-white">{check.name}</p>
                      {(check.message || check.latencyMs != null) && (
                        <p className="text-sm text-slate-400">
                          {check.message}
                          {check.latencyMs != null && ` · ${check.latencyMs}ms`}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-medium capitalize ${color}`}
                  >
                    {check.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Orchestrator & modules */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-neon-cyan" />
            AI Orchestrator & modules
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/ai/orchestrator"
              className="rounded-xl glass border border-neon-cyan/20 p-4 hover:border-neon-cyan/50 transition-colors"
            >
              <Brain className="w-8 h-8 text-neon-cyan mb-2" />
              <p className="font-medium text-white">Intelligence Hub</p>
              <p className="text-xs text-slate-400">Phase 27 — System-wide AI</p>
            </Link>
            <div className="rounded-xl glass border border-white/10 p-4">
              <Database className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-medium text-white">Database</p>
              <p className="text-xs text-slate-400">Neon Postgres + PGVector</p>
            </div>
            <div className="rounded-xl glass border border-white/10 p-4">
              <Key className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-medium text-white">Clerk</p>
              <p className="text-xs text-slate-400">Auth & orgs</p>
            </div>
            <div className="rounded-xl glass border border-white/10 p-4">
              <CreditCard className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-medium text-white">Stripe</p>
              <p className="text-xs text-slate-400">Payments</p>
            </div>
            <div className="rounded-xl glass border border-white/10 p-4">
              <Zap className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-medium text-white">Redis</p>
              <p className="text-xs text-slate-400">Rate limit & cache</p>
            </div>
            <div className="rounded-xl glass border border-white/10 p-4">
              <Video className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-medium text-white">Daily.co</p>
              <p className="text-xs text-slate-400">Live video</p>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            Quick links
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/health"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 border border-white/10"
            >
              Admin health
            </Link>
            <Link
              href="/admin/requests"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 border border-white/10"
            >
              Onboarding requests
            </Link>
            <Link
              href="/beta"
              className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 border border-white/10"
            >
              Beta signup
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
