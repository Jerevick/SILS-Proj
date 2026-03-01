"use client";

/**
 * Phase 27: SILS Intelligence Hub — central AI dashboard.
 * Tabs: Proactive Insights, Active Interventions, Course Builder, Student Mastery Explorer, System Health.
 * Shadcn-style cards, MUI Data Grid for logs/insights, global chat with optional streaming.
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
  Activity,
  ClipboardList,
  GraduationCap,
  Heart,
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  getSystemInsights,
  runSystemOrchestrator,
  applySystemInsight,
  type SystemInsightRow,
} from "@/app/actions/ai-orchestrator-actions";
import { ThemeProvider, createTheme, Box } from "@mui/material";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { useOrchestratorMutation, fetchGlobalChat, streamGlobalChat } from "@/hooks/use-ai-orchestrator";

const INSIGHTS_QUERY_KEY = ["system-insights"] as const;
const REFETCH_INTERVAL_MS = 60 * 1000;

function formatDate(d: Date) {
  return new Date(d).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
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

const dashboardDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.6)" },
  },
  typography: { fontFamily: "var(--font-display), system-ui, sans-serif" },
});

export default function AIOrchestratorPage() {
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const healthMutation = useOrchestratorMutation({
    onSuccess: (data) => {
      if (data.ok && "result" in data) queryClient.invalidateQueries({ queryKey: ["health"] });
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
    setStreamingContent("");
    setChatLoading(true);
    try {
      await streamGlobalChat(text, newHistory, {
        onChunk: (chunk) => setStreamingContent((prev) => prev + chunk),
        onDone: (fullText) => {
          setChatHistory((prev) => [...prev, { role: "assistant", content: fullText }]);
          setStreamingContent("");
        },
        onError: (error) => {
          setChatHistory((prev) => [...prev, { role: "assistant", content: `Error: ${error}` }]);
          setStreamingContent("");
        },
      });
    } catch {
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Error: request failed" }]);
      setStreamingContent("");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingContent]);

  const insightsGridColumns: GridColDef<SystemInsightRow & { id: string }>[] = [
    { field: "insightType", headerName: "Type", width: 160, renderCell: ({ row }) => <span className="flex items-center gap-1">{insightTypeIcon(row.insightType)} {row.insightType}</span> },
    { field: "title", headerName: "Title", flex: 1, minWidth: 180 },
    { field: "confidenceScore", headerName: "Confidence", width: 100, valueFormatter: ({ value }) => `${Math.round((value as number) * 100)}%` },
    { field: "createdAt", headerName: "Created", width: 150, valueFormatter: ({ value }) => formatDate(value as Date) },
    {
      field: "appliedAt",
      headerName: "Status",
      width: 100,
      renderCell: ({ row }) =>
        row.appliedAt ? (
          <span className="text-emerald-400 text-xs">Applied</span>
        ) : (
          <button
            type="button"
            onClick={() => applyMutation.mutate(row.id)}
            disabled={applyMutation.isPending}
            className="text-neon-cyan text-xs hover:underline"
          >
            Apply
          </button>
        ),
    },
  ];

  const insightsRows = insights.map((r) => ({ ...r, id: r.id }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-3">
            <div className="rounded-xl bg-neon-cyan/20 p-2 border border-neon-cyan/40">
              <Brain className="w-8 h-8 text-neon-cyan" />
            </div>
            SILS Intelligence Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Central AI — proactive insights, interventions, course builder, and system health
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

      <Tabs.Root defaultValue="insights" className="space-y-4">
        <Tabs.List className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-full overflow-x-auto">
          <Tabs.Trigger
            value="insights"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400 data-[state=active]:border data-[state=active]:border-neon-cyan/40"
          >
            <Sparkles className="w-4 h-4" />
            Proactive Insights
          </Tabs.Trigger>
          <Tabs.Trigger
            value="interventions"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400 data-[state=active]:border data-[state=active]:border-neon-cyan/40"
          >
            <ClipboardList className="w-4 h-4" />
            Active Interventions
          </Tabs.Trigger>
          <Tabs.Trigger
            value="course"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400 data-[state=active]:border data-[state=active]:border-neon-cyan/40"
          >
            <BookOpen className="w-4 h-4" />
            Course Builder
          </Tabs.Trigger>
          <Tabs.Trigger
            value="mastery"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400 data-[state=active]:border data-[state=active]:border-neon-cyan/40"
          >
            <GraduationCap className="w-4 h-4" />
            Student Mastery
          </Tabs.Trigger>
          <Tabs.Trigger
            value="health"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400 data-[state=active]:border data-[state=active]:border-neon-cyan/40"
          >
            <Heart className="w-4 h-4" />
            System Health
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="insights" className="space-y-4">
          <div className="glass rounded-xl border border-white/5 overflow-hidden p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-purple" />
              Live AI insights
            </h2>
            {insightsLoading && insightsRows.length === 0 ? (
              <p className="text-slate-500 text-sm">Loading insights…</p>
            ) : insightsRows.length === 0 ? (
              <p className="text-slate-500 text-sm">No insights yet. Run the orchestrator to generate recommendations.</p>
            ) : (
              <ThemeProvider theme={dashboardDarkTheme}>
                <Box sx={{ "& .MuiDataGrid-root": { border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }, minHeight: 320 }}>
                  <DashboardDataGrid
                    columns={insightsGridColumns}
                    rows={insightsRows}
                    getRowId={(r) => r.id}
                    pageSize={10}
                  />
                </Box>
              </ThemeProvider>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="interventions">
          <div className="glass rounded-xl border border-white/5 overflow-hidden p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-400" />
              Active intervention briefs
            </h2>
            <p className="text-slate-500 text-sm">
              View and manage intervention briefs from the{" "}
              <Link href="/ai/orchestrator" className="text-neon-cyan hover:underline">
                detect_friction_and_intervene
              </Link>{" "}
              action. Use the API or run orchestrator to generate new briefs.
            </p>
            <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-4 text-slate-400 text-sm">
              Pending and sent briefs appear here. Link to your interventions list when the route exists.
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="course">
          <div className="glass rounded-xl border border-white/5 overflow-hidden p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-neon-cyan" />
              Course Builder
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Generate full course or module structures (syllabus, outcomes, adaptive pathways) via the orchestrator{" "}
              <code className="bg-white/10 px-1 rounded">generate_course</code> / <code className="bg-white/10 px-1 rounded">generate_module</code> actions.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-slate-400 text-sm">
              Use the Global AI assistant on the right to ask: &quot;Generate a module outline for Introduction to Statistics&quot; or call POST /api/ai/orchestrator with action generate_module.
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="mastery">
          <div className="glass rounded-xl border border-white/5 overflow-hidden p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-violet-400" />
              Student Mastery Explorer
            </h2>
            <p className="text-slate-500 text-sm">
              Adaptive pathway and next-best-content recommendations use the{" "}
              <code className="bg-white/10 px-1 rounded">adaptive_pathway</code> action with studentId and moduleId.
            </p>
            <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-4 text-slate-400 text-sm">
              Query mastery via tools (getStudentMastery) or ask the assistant: &quot;What should student X study next in module Y?&quot;
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="health">
          <div className="glass rounded-xl border border-white/5 overflow-hidden p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-emerald-400" />
              System Health
            </h2>
            <button
              type="button"
              onClick={() => healthMutation.mutate({ action: "health_check", payload: {} })}
              disabled={healthMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              {healthMutation.isPending ? "Running…" : "Run health check"}
            </button>
            {healthMutation.data && healthMutation.data.ok && "result" in healthMutation.data && (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                <pre className="text-slate-300 whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify((healthMutation.data.result as { checks?: unknown[]; summary?: string })?.summary ?? healthMutation.data.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2" />
        <div className="glass rounded-xl border border-white/5 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-neon-cyan" />
            <h2 className="font-display text-lg font-semibold text-white">Global AI assistant</h2>
          </div>
          <div className="flex-1 flex flex-col min-h-[320px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 && !streamingContent && (
                <p className="text-slate-500 text-sm mb-2">Ask anything:</p>
              )}
              {chatHistory.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-neon-cyan/20 text-neon-cyan ml-6" : "bg-white/10 text-slate-200 mr-6"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {streamingContent && (
                <div className="rounded-lg bg-white/10 text-slate-200 px-3 py-2 text-sm mr-6">{streamingContent}</div>
              )}
              {chatLoading && !streamingContent && (
                <div className="rounded-lg bg-white/10 text-slate-400 px-3 py-2 text-sm mr-6">Thinking…</div>
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

      {runOrchestratorMutation.data && runOrchestratorMutation.data.ok && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 space-y-1">
          <p>
            Generated {runOrchestratorMutation.data.insightsGenerated} insights, stored{" "}
            {runOrchestratorMutation.data.insightsStored}, auto-applied {runOrchestratorMutation.data.insightsAutoApplied}.
          </p>
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
