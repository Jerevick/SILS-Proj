"use client";

/**
 * Phase 27: SILS Intelligence Hub — central AI dashboard.
 * Live AI insights feed, System Health & Recommendations with one-click apply,
 * and global AI chat ("Optimize this semester's timetable", "Find equity gaps", etc.).
 * Uses TanStack Query for real-time updates.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Brain,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  BookOpen,
  Send,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  getSystemInsights,
  runSystemOrchestrator,
  applySystemInsight,
  globalAIChat,
  type SystemInsightRow,
} from "@/app/actions/ai-orchestrator-actions";

const INSIGHTS_QUERY_KEY = ["system-insights"] as const;
const REFETCH_INTERVAL_MS = 60 * 1000; // 1 minute

function formatDate(d: Date) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function insightTypeIcon(type: string) {
  switch (type) {
    case "student_struggling":
      return <BookOpen className="w-4 h-4 text-amber-400" />;
    case "equity_gap":
      return <Users className="w-4 h-4 text-violet-400" />;
    case "timetable_optimization":
      return <Calendar className="w-4 h-4 text-neon-cyan" />;
    case "finance_alert":
      return <DollarSign className="w-4 h-4 text-rose-400" />;
    case "retention_risk":
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    default:
      return <TrendingUp className="w-4 h-4 text-neon-purple" />;
  }
}

const SUGGESTED_PROMPTS = [
  "Optimize this semester's timetable",
  "Find equity gaps across programmes",
  "Which students are at retention risk?",
  "Summarize overdue invoices and financial aid",
  "Suggest bridging content for struggling students",
];

export default function AIOrchestratorPage() {
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live insights feed — refetch every minute for real-time feel
  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: INSIGHTS_QUERY_KEY,
    queryFn: async () => getSystemInsights({ limit: 30 }),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const runOrchestratorMutation = useMutation({
    mutationFn: (dryRun: boolean) => runSystemOrchestrator({ dryRun }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSIGHTS_QUERY_KEY });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (insightId: string) => applySystemInsight(insightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSIGHTS_QUERY_KEY });
    },
  });

  const insights: SystemInsightRow[] = insightsData?.ok ? insightsData.insights : [];

  const sendChat = async (message?: string) => {
    const text = (message ?? chatMessage).trim();
    if (!text) return;
    setChatMessage("");
    const newHistory = [...chatHistory, { role: "user" as const, content: text }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const result = await globalAIChat(text, newHistory);
      if (result.ok) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: result.text }]);
      } else {
        setChatHistory((prev) => [...prev, { role: "assistant", content: `Error: ${result.error}` }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
          >
            ← Dashboard
          </Link>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
            <div className="rounded-xl bg-neon-cyan/20 p-2 border border-neon-cyan/40">
              <Brain className="w-8 h-8 text-neon-cyan" />
            </div>
            SILS Intelligence Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Central AI that monitors all modules and surfaces proactive insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runOrchestratorMutation.mutate(false)}
            disabled={runOrchestratorMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {runOrchestratorMutation.isPending ? "Running…" : "Run orchestrator"}
          </button>
          <button
            type="button"
            onClick={() => refetchInsights()}
            disabled={insightsLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 border border-white/20 hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Live AI insights feed + System Health & Recommendations */}
        <div className="xl:col-span-2 space-y-6">
          <section className="glass rounded-xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-purple" />
              <h2 className="font-display text-lg font-semibold text-white">
                Live AI insights
              </h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-4 space-y-3">
              {insightsLoading && insights.length === 0 ? (
                <p className="text-slate-500 text-sm">Loading insights…</p>
              ) : insights.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  No insights yet. Run the orchestrator to generate cross-module recommendations.
                </p>
              ) : (
                insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded-lg border p-4 ${
                      ins.appliedAt
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-lg bg-white/10 p-2 shrink-0">
                          {insightTypeIcon(ins.insightType)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-white text-sm">{ins.title}</h3>
                          <p className="text-slate-400 text-xs mt-1">{ins.description}</p>
                          <p className="text-slate-500 text-xs mt-2">
                            {formatDate(ins.createdAt)} · {(ins.confidenceScore * 100).toFixed(0)}% confidence
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ins.actionLink && (
                          <Link
                            href={ins.actionLink}
                            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 border border-white/20 hover:bg-white/15"
                          >
                            Open
                          </Link>
                        )}
                        {ins.appliedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => applyMutation.mutate(ins.id)}
                            disabled={applyMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-neon-cyan/20 px-2.5 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right: Global AI chat */}
        <div className="glass rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-neon-cyan" />
            <h2 className="font-display text-lg font-semibold text-white">
              Global AI assistant
            </h2>
          </div>
          <div className="flex-1 flex flex-col min-h-[320px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 && (
                <p className="text-slate-500 text-sm mb-2">Ask anything:</p>
              )}
              {chatHistory.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-neon-cyan/20 text-neon-cyan ml-6"
                      : "bg-white/10 text-slate-200 mr-6"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div className="rounded-lg bg-white/10 text-slate-400 px-3 py-2 text-sm mr-6">
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-white/5 space-y-2">
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendChat(prompt)}
                    disabled={chatLoading}
                    className="text-xs rounded-full bg-white/10 text-slate-400 hover:text-white hover:bg-white/15 px-3 py-1.5 border border-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="e.g. Optimize timetable, find equity gaps…"
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                />
                <button
                  type="button"
                  onClick={() => sendChat()}
                  disabled={chatLoading || !chatMessage.trim()}
                  className="rounded-lg bg-neon-cyan/20 p-2 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Run result toast */}
      {runOrchestratorMutation.data && runOrchestratorMutation.data.ok && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 space-y-1">
          <p>Generated {runOrchestratorMutation.data.insightsGenerated} insights, stored {runOrchestratorMutation.data.insightsStored}, auto-applied {runOrchestratorMutation.data.insightsAutoApplied}.</p>
          {runOrchestratorMutation.data.summary && (
            <p className="text-emerald-100/90 text-xs mt-2">{runOrchestratorMutation.data.summary}</p>
          )}
        </div>
      )}
      {runOrchestratorMutation.data && !runOrchestratorMutation.data.ok && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {(runOrchestratorMutation.data as { error: string }).error}
        </div>
      )}
    </div>
  );
}
