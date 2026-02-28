"use client";

/**
 * Phase 19: Advanced Institutional Analytics & BI Dashboard — command center for university leaders.
 * Tabs: Retention & At-Risk, Equity & Inclusion, Financial Overview, Cohort Performance, Engagement & Learning, AI Insights.
 * Recharts visualizations, date/school/department/programme filters, AI Insights panel with Top 5 Recommendations, Export PDF/CSV.
 * Scoped: Institution Admin, Dean, Registrar, Super Admin (OWNER, ADMIN, or platform staff with tenant).
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AdminShell } from "../components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Sparkles,
  Download,
  FileText,
  RefreshCw,
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  GraduationCap,
  Activity,
  Lightbulb,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useMe } from "@/hooks/use-me";
import {
  generateAnalyticsReport,
  getLatestAnalyticsSnapshot,
  type ReportType,
  type GenerateAnalyticsReportResult,
  type AnalyticsChartData,
  type AnalyticsRecommendation,
} from "@/app/actions/analytics-actions";
import type { HierarchyResponse } from "@/app/api/hierarchy/route";

const REPORT_TABS: { value: ReportType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "retention", label: "Retention & At-Risk", icon: TrendingUp },
  { value: "equity", label: "Equity & Inclusion", icon: Users },
  { value: "financial", label: "Financial Overview", icon: DollarSign },
  { value: "cohort", label: "Cohort Performance", icon: GraduationCap },
  { value: "engagement", label: "Engagement & Learning", icon: Activity },
  { value: "overall", label: "AI Insights", icon: Lightbulb },
];

const CHART_COLORS = ["#00f5ff", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

async function fetchHierarchy(): Promise<HierarchyResponse> {
  const res = await fetch("/api/hierarchy");
  if (!res.ok) throw new Error("Failed to fetch hierarchy");
  return res.json();
}

function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 6);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

export default function AdminAnalyticsPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [activeTab, setActiveTab] = useState<ReportType>("overall");
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [programmeId, setProgrammeId] = useState<string | null>(null);

  const isPlatformStaff = me?.kind === "platform_staff";
  const tenantId = me?.kind === "tenant" ? me.tenantId : null;
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const effectiveTenantId = tenantId ?? selectedTenantId;

  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
    enabled: !!tenantId,
  });

  const { data: institutions } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/institutions");
      if (!res.ok) throw new Error("Failed to fetch institutions");
      const data = await res.json();
      return data as { id: string; name: string; slug: string }[];
    },
    enabled: isPlatformStaff,
  });

  const schools = hierarchy?.schools ?? [];
  const departments = useMemo(() => {
    const deps: { id: string; name: string; code: string | null }[] = [];
    hierarchy?.schools?.forEach((s) => s.departments.forEach((d) => deps.push({ id: d.id, name: d.name, code: d.code })));
    hierarchy?.faculties?.forEach((f) => f.departments.forEach((d) => deps.push({ id: d.id, name: d.name, code: d.code })));
    return [...new Map(deps.map((d) => [d.id, d])).values()];
  }, [hierarchy]);
  const programmes = useMemo(() => {
    const progs: { id: string; name: string; code: string; departmentId: string }[] = [];
    hierarchy?.schools?.forEach((s) =>
      s.departments.forEach((d) => d.programmes.forEach((p) => progs.push({ ...p, departmentId: d.id })))
    );
    hierarchy?.faculties?.forEach((f) =>
      f.departments.forEach((d) => d.programmes.forEach((p) => progs.push({ ...p, departmentId: d.id })))
    );
    return [...new Map(progs.map((p) => [p.id, p])).values()];
  }, [hierarchy]);

  const canAccess = me?.kind === "tenant" ? (me.role === "OWNER" || me.role === "ADMIN") : !!isPlatformStaff;
  if (!canAccess && me && me.kind !== "no_org") {
    return (
      <AdminShell activeNav="analytics">
        <div className="rounded-xl glass-card border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-amber-400 mb-4" />
          <h1 className="font-display text-xl font-semibold text-white mb-2">Access restricted</h1>
          <p className="text-slate-400 text-sm">
            Only Institution Admin, Dean, Registrar, or Super Admin can access the Analytics & BI Dashboard.
          </p>
        </div>
      </AdminShell>
    );
  }

  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["analytics-snapshot", effectiveTenantId ?? "", activeTab],
    queryFn: () => getLatestAnalyticsSnapshot(effectiveTenantId!, activeTab),
    enabled: !!effectiveTenantId,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateAnalyticsReport({
        tenantId: effectiveTenantId!,
        reportType: activeTab,
        dateFrom,
        dateTo,
        schoolId: schoolId ?? undefined,
        departmentId: departmentId ?? undefined,
        programmeId: programmeId ?? undefined,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["analytics-snapshot", effectiveTenantId ?? "", activeTab] });
        toast.success("Report generated");
      } else {
        toast.error(result.error);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to generate report"),
  });

  const reportData = snapshot?.ok ? snapshot : null;
  const charts = reportData?.charts ?? ({} as AnalyticsChartData);
  const recommendations = reportData?.recommendations ?? [];
  const insights = reportData?.insights ?? [];
  const summary = reportData?.summary ?? "";

  const handleExportCSV = () => {
    if (!reportData?.charts) return;
    const rows: string[][] = [];
    if (charts.bar) {
      charts.bar.forEach((b, i) => {
        b.data.forEach((d) => rows.push([`Bar ${i + 1}`, String(d.name), String((d as { value?: number }).value ?? "")]));
      });
    }
    if (charts.line) {
      charts.line.forEach((l, i) => {
        l.data.forEach((d) => rows.push([`Line ${i + 1}`, String(d.name), String((d as Record<string, unknown>)[l.series.dataKey] ?? "")]));
      });
    }
    if (rows.length === 0) {
      rows.push(["No chart data"]);
    }
    const csv = [["Chart", "Category", "Value"], ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const handleExportPDF = () => {
    window.print();
    toast.success("Use browser Print to save as PDF");
  };

  return (
    <AdminShell activeNav="analytics">
      <div className="relative min-h-screen bg-grid-pattern bg-space-950">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <BarChart3 className="h-5 w-5 text-neon-cyan/80" />
              <span className="text-sm font-medium">Executive intelligence</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Analytics & BI Dashboard
            </h1>
            <p className="text-slate-400 mt-1 max-w-2xl">
              Data-rich insights across retention, equity, finance, cohorts, and engagement. AI-powered recommendations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-slate-200 hover:bg-white/10"
              onClick={() => { queryClient.invalidateQueries({ queryKey: ["analytics-snapshot", effectiveTenantId ?? "", activeTab] }); }}
              disabled={!effectiveTenantId}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-slate-200 hover:bg-white/10"
              onClick={handleExportCSV}
              disabled={!reportData?.charts}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-slate-200 hover:bg-white/10"
              onClick={handleExportPDF}
            >
              <FileText className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </div>
        </div>

        {isPlatformStaff && (
          <div className="rounded-xl glass-card border border-white/10 p-4 mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Institution</label>
            <Select
              value={selectedTenantId ?? ""}
              onValueChange={(v) => setSelectedTenantId(v || null)}
            >
              <SelectTrigger className="max-w-md border-white/20 bg-white/5 text-white">
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                {(institutions ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {effectiveTenantId && (
          <div className="rounded-xl glass-card border border-white/10 p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date to</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">School</label>
                <Select value={schoolId ?? ""} onValueChange={(v) => { setSchoolId(v || null); setDepartmentId(null); setProgrammeId(null); }}>
                  <SelectTrigger className="border-white/20 bg-white/5 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                <Select value={departmentId ?? ""} onValueChange={(v) => { setDepartmentId(v || null); setProgrammeId(null); }}>
                  <SelectTrigger className="border-white/20 bg-white/5 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Programme</label>
                <Select value={programmeId ?? ""} onValueChange={(v) => setProgrammeId(v || null)}>
                  <SelectTrigger className="border-white/20 bg-white/5 text-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {programmes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {!effectiveTenantId && (
          <div className="rounded-xl glass-card border border-white/10 p-8 text-center text-slate-500">
            {isPlatformStaff ? "Select an institution above." : "No organization context. Switch to your institution."}
          </div>
        )}

        {effectiveTenantId && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)} className="w-full">
                <TabsList className="w-full flex flex-wrap h-auto gap-1 rounded-xl bg-white/5 border border-white/10 p-2">
                  {REPORT_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-2 rounded-lg data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan text-slate-400"
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {REPORT_TABS.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-6 focus:outline-none">
                    {snapshotLoading && (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
                      </div>
                    )}
                    {(!reportData && !snapshotLoading) || (snapshot && !snapshot.ok) ? (
                      <div className="rounded-xl glass-card border border-white/10 p-8 text-center">
                        <p className="text-slate-400 mb-4">
                          {snapshot && !snapshot.ok ? (snapshot as { error?: string }).error : "No report generated yet for this view."}
                        </p>
                        <Button
                          onClick={() => generateMutation.mutate()}
                          disabled={generateMutation.isPending}
                          className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                        >
                          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                          Generate report
                        </Button>
                      </div>
                    ) : reportData && !snapshotLoading ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {summary && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm text-slate-200">{summary}</p>
                          </div>
                        )}

                        {charts.line && charts.line.length > 0 && (
                          <div className="rounded-xl glass-card border border-white/10 p-6">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">Trends</h3>
                            <div className="h-72">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={charts.line[0].data}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                  <XAxis dataKey="name" stroke="rgba(148,163,184,0.6)" fontSize={11} />
                                  <YAxis stroke="rgba(148,163,184,0.6)" fontSize={11} />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: "rgba(15,15,35,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                    labelStyle={{ color: "#e2e8f0" }}
                                  />
                                  <Legend />
                                  {charts.line.map((series, i) => (
                                    <Line
                                      key={i}
                                      type="monotone"
                                      dataKey={series.series.dataKey}
                                      name={series.series.name}
                                      stroke={series.series.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                                      strokeWidth={2}
                                      dot={{ fill: series.series.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
                                    />
                                  ))}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {charts.bar && charts.bar.length > 0 && (
                          <div className="rounded-xl glass-card border border-white/10 p-6">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">Distribution</h3>
                            <div className="h-72">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={charts.bar[0].data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                  <XAxis dataKey="name" stroke="rgba(148,163,184,0.6)" fontSize={11} />
                                  <YAxis stroke="rgba(148,163,184,0.6)" fontSize={11} />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: "rgba(15,15,35,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                  />
                                  <Bar dataKey="value" fill="#00f5ff" radius={[4, 4, 0, 0]} name="Count" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {charts.area && charts.area.length > 0 && charts.area[0].data.length > 0 && (
                          <div className="rounded-xl glass-card border border-white/10 p-6">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">Equity breakdown</h3>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={charts.area[0].data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, value }) => `${name}: ${value}`}
                                  >
                                    {charts.area[0].data.map((_, i) => (
                                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ backgroundColor: "rgba(15,15,35,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {charts.funnel?.steps && charts.funnel.steps.length > 0 && (
                          <div className="rounded-xl glass-card border border-white/10 p-6">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">Pipeline funnel</h3>
                            <div className="space-y-2">
                              {charts.funnel.steps.map((step, i) => (
                                <div key={i} className="flex items-center gap-3">
                                  <div
                                    className="h-8 rounded-md transition-all min-w-[80px]"
                                    style={{
                                      width: `${Math.max(10, (step.value / Math.max(1, charts.funnel!.steps[0].value)) * 100)}%`,
                                      backgroundColor: step.fill ?? CHART_COLORS[i % CHART_COLORS.length],
                                      opacity: 0.8,
                                    }}
                                  />
                                  <span className="text-sm text-slate-300">{step.name}</span>
                                  <span className="text-sm font-medium text-white tabular-nums">{step.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {insights.length > 0 && (
                          <div className="rounded-xl glass-card border border-white/10 p-6">
                            <h3 className="font-display text-sm font-semibold text-white mb-4">Key insights</h3>
                            <ul className="space-y-3">
                              {insights.map((insight, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className={`shrink-0 mt-0.5 ${insight.trend === "up" ? "text-emerald-400" : insight.trend === "down" ? "text-red-400" : "text-slate-500"}`}>
                                    {insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "•"}
                                  </span>
                                  <div>
                                    <p className="font-medium text-white text-sm">{insight.title}</p>
                                    <p className="text-slate-400 text-sm">{insight.summary}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => generateMutation.mutate()}
                            disabled={generateMutation.isPending}
                            variant="outline"
                            className="border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
                          >
                            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Regenerate with AI
                          </Button>
                        </div>
                      </motion.div>
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div className="space-y-6">
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl glass-card overflow-hidden border border-neon-cyan/20 bg-gradient-to-b from-neon-cyan/5 to-transparent"
              >
                <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
                  <Sparkles className="h-5 w-5 text-neon-cyan" />
                  <h2 className="font-display text-lg font-semibold text-white">AI Insights</h2>
                </div>
                <div className="p-6">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Top 5 Recommendations</p>
                  {recommendations.length === 0 && !snapshotLoading && (
                    <p className="text-slate-500 text-sm">Generate a report to see AI recommendations.</p>
                  )}
                  <ul className="space-y-4">
                    {recommendations.map((rec: AnalyticsRecommendation) => (
                      <li key={rec.id}>
                        <RecommendationCard recommendation={rec} />
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.section>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function RecommendationCard({ recommendation }: { recommendation: AnalyticsRecommendation }) {
  const priorityColor =
    recommendation.priority === "high"
      ? "border-amber-500/50 bg-amber-500/10"
      : recommendation.priority === "low"
        ? "border-slate-500/50 bg-slate-500/10"
        : "border-neon-cyan/30 bg-neon-cyan/5";
  return (
    <div className={`rounded-xl border p-4 ${priorityColor} transition hover:border-white/20`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-white text-sm">{recommendation.title}</p>
          <p className="text-slate-400 text-xs mt-1">{recommendation.description}</p>
        </div>
        {recommendation.actionLabel && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-neon-cyan hover:bg-neon-cyan/20 h-8"
            onClick={() => toast.info(recommendation.actionLabel)}
          >
            {recommendation.actionLabel}
            <ChevronRight className="h-4 w-4 ml-0.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
