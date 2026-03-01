"use client";

/**
 * Phase 24: Detailed faculty workload dashboard.
 * Visual breakdown (Recharts), AI recommendations panel, and Adjust Workload tools.
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFacultyProfile,
  calculateFacultyWorkload,
  getHRFilterOptions,
  createWorkloadAssignment,
  updateWorkloadAssignment,
  deleteWorkloadAssignment,
  type CreateWorkloadAssignmentInput,
} from "@/app/actions/hr-faculty-actions";
import type { WorkloadType } from "@prisma/client";

const WORKLOAD_COLORS = ["#00f5ff", "#a78bfa", "#34d399", "#f59e0b"];

function displayName(firstName: string | null, lastName: string | null, email: string | null) {
  if (firstName || lastName) return `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return email ?? "—";
}

export default function HrWorkloadFacultyPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const facultyId = params.facultyId as string;
  const [termId, setTermId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<CreateWorkloadAssignmentInput>({
    facultyId,
    moduleId: "",
    workloadType: "TEACHING",
    hoursAllocated: 0,
    termId: "",
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["hr-faculty-profile", facultyId],
    queryFn: async () => {
      const r = await getFacultyProfile(facultyId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    enabled: !!facultyId,
  });

  const { data: options } = useQuery({
    queryKey: ["hr-filter-options"],
    queryFn: async () => {
      const r = await getHRFilterOptions();
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const { data: workloadData, isLoading: workloadLoading } = useQuery({
    queryKey: ["hr-workload", facultyId, termId],
    queryFn: async () => {
      const r = await calculateFacultyWorkload(facultyId, termId);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    enabled: !!facultyId && !!termId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateWorkloadAssignmentInput) => createWorkloadAssignment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-workload", facultyId, termId] });
      setAddOpen(false);
      setAddForm({ facultyId, moduleId: "", workloadType: "TEACHING", hoursAllocated: 0, termId: "" });
      toast.success("Workload assignment added.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, hoursAllocated }: { id: string; hoursAllocated: number }) =>
      updateWorkloadAssignment({ id, hoursAllocated }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-workload", facultyId, termId] });
      setEditId(null);
      toast.success("Assignment updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkloadAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-workload", facultyId, termId] });
      toast.success("Assignment removed.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const profile = profileData?.profile;
  const workload = workloadData?.ok ? workloadData : null;
  const breakdown = workload?.breakdown ?? [];
  const chartData = breakdown.map((b, i) => ({
    name: b.type.replace(/_/g, " "),
    hours: b.hours,
    fill: WORKLOAD_COLORS[i % WORKLOAD_COLORS.length],
  }));
  const allAssignments = breakdown.flatMap((b) =>
    b.assignments.map((a) => ({ ...a, type: b.type }))
  );

  const handleAdd = () => {
    if (!addForm.moduleId || !addForm.termId || addForm.hoursAllocated <= 0) {
      toast.error("Select module, term, and enter hours.");
      return;
    }
    createMutation.mutate({ ...addForm, facultyId, termId: addForm.termId });
  };

  if (profileLoading || !profile) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400">
        {profileLoading ? "Loading…" : "Faculty not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/hr/faculty"
            className="text-slate-400 hover:text-white text-sm mb-2 inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Faculty
          </Link>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-neon-cyan" />
            Workload — {displayName(profile.user.firstName, profile.user.lastName, profile.user.email)}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {profile.department?.name ?? "—"} · Max {profile.maxWorkloadHours} hrs/term
          </p>
        </div>
      </div>

      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white">Term</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={termId || "select"} onValueChange={(v) => setTermId(v === "select" ? "" : v)}>
            <SelectTrigger className="w-[220px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="select">Select a term</SelectItem>
              {options?.terms?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!termId && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="py-12 text-center text-slate-500">
            Select a term above to view workload breakdown and AI recommendations.
          </CardContent>
        </Card>
      )}

      {termId && workloadLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          Calculating workload…
        </div>
      )}

      {termId && workload && (
        <>
          {/* Summary + overload alert */}
          <Card className={`border-white/10 bg-space-800/50 ${workload.overloadAlert ? "border-amber-500/40" : ""}`}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Total hours this term</p>
                  <p className="text-2xl font-bold text-white">{workload.totalHours} hrs</p>
                  <p className="text-slate-500 text-sm">Max: {workload.maxWorkloadHours} hrs</p>
                </div>
                {workload.overloadAlert && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Over allocated</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recharts: Bar + Pie */}
            <Card className="border-white/10 bg-space-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-neon-cyan" />
                  Workload by type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">No assignments this term.</p>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                          labelStyle={{ color: "#e2e8f0" }}
                        />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={chartData[i].fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-space-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-neon-cyan" />
                  AI recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workload.aiRecommendations.length === 0 ? (
                  <p className="text-slate-500 text-sm">No recommendations for this workload.</p>
                ) : (
                  <ul className="space-y-2">
                    {workload.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                        <span className="text-neon-cyan shrink-0">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Adjust Workload: list + add */}
          <Card className="border-white/10 bg-space-800/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-white">Assignments</CardTitle>
              <Button
                size="sm"
                className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                onClick={() => {
                  setAddForm({
                    facultyId,
                    moduleId: options?.modules?.[0]?.id ?? "",
                    workloadType: "TEACHING",
                    hoursAllocated: 0,
                    termId,
                  });
                  setAddOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add assignment
              </Button>
            </CardHeader>
            <CardContent>
              {allAssignments.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No assignments. Click &quot;Add assignment&quot; to add teaching, research, admin, or service hours.</p>
              ) : (
                <div className="space-y-2">
                  {allAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-space-900/80 border border-white/5"
                    >
                      <div>
                        <p className="font-medium text-white">{a.moduleTitle}</p>
                        <p className="text-xs text-slate-400">
                          {a.type.replace(/_/g, " ")} · {a.hoursAllocated} hrs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {editId === a.id ? (
                          <>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              className="w-20 h-8 text-sm bg-space-800 border-white/20"
                              defaultValue={a.hoursAllocated}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!Number.isNaN(v) && v >= 0) {
                                  updateMutation.mutate({ id: a.id, hoursAllocated: v });
                                }
                                setEditId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const v = parseFloat((e.target as HTMLInputElement).value);
                                  if (!Number.isNaN(v) && v >= 0) {
                                    updateMutation.mutate({ id: a.id, hoursAllocated: v });
                                  }
                                  setEditId(null);
                                }
                              }}
                            />
                            <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400"
                              onClick={() => setEditId(a.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => {
                                if (confirm("Remove this assignment?")) deleteMutation.mutate(a.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add assignment dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-space-800 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add workload assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-slate-400">Module</Label>
              <Select
                value={addForm.moduleId}
                onValueChange={(v) => setAddForm((p) => ({ ...p, moduleId: v }))}
              >
                <SelectTrigger className="mt-1 border-white/20 bg-space-900 text-slate-200">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {options?.modules?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Type</Label>
              <Select
                value={addForm.workloadType}
                onValueChange={(v) => setAddForm((p) => ({ ...p, workloadType: v as WorkloadType }))}
              >
                <SelectTrigger className="mt-1 border-white/20 bg-space-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEACHING">Teaching</SelectItem>
                  <SelectItem value="RESEARCH">Research</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Hours allocated</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="mt-1 border-white/20 bg-space-900 text-slate-200"
                value={addForm.hoursAllocated || ""}
                onChange={(e) =>
                  setAddForm((p) => ({
                    ...p,
                    hoursAllocated: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <input type="hidden" value={addForm.termId} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
              onClick={handleAdd}
              disabled={createMutation.isPending || !addForm.moduleId || addForm.hoursAllocated <= 0}
            >
              {createMutation.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
