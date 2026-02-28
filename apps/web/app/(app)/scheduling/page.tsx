"use client";

/**
 * Phase 20: Intelligent Scheduling & Timetabling — timetable builder with calendar view,
 * "Generate Optimal Timetable" (IntelligentTimetabler), and visual conflict resolver.
 * Filters: School / Department / Programme / Term. Integrates with academic calendar and hierarchy.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Filter,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
  User,
  ChevronDown,
  Wrench,
  Building2,
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
import {
  listSchedules,
  listRooms,
  IntelligentTimetabler,
  resolveScheduleConflict,
  getSchedulingFilterOptions,
  type ScheduleListItem,
  type ScheduleFilters,
  type ConflictReport,
  type RoomListItem,
} from "@/app/actions/scheduling-actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8–18

function minutesToLabel(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export default function SchedulingPage() {
  const queryClient = useQueryClient();
  const [termId, setTermId] = useState<string>("");
  const [programmeId, setProgrammeId] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [lastConflictReport, setLastConflictReport] = useState<ConflictReport | null>(null);
  const [resolveModal, setResolveModal] = useState<{
    schedule: ScheduleListItem;
    open: boolean;
  } | null>(null);
  const [resolveRoomId, setResolveRoomId] = useState<string>("");
  const [resolveDay, setResolveDay] = useState<number>(1);
  const [resolveStart, setResolveStart] = useState<number>(540);
  const [resolveEnd, setResolveEnd] = useState<number>(630);

  const filters: ScheduleFilters = useMemo(() => {
    const f: ScheduleFilters = {};
    if (termId) f.termId = termId;
    if (programmeId) f.programmeId = programmeId;
    if (schoolId) f.schoolId = schoolId;
    if (departmentId) f.departmentId = departmentId;
    return f;
  }, [termId, programmeId, schoolId, departmentId]);

  const { data: options } = useQuery({
    queryKey: ["scheduling-filter-options"],
    queryFn: async () => {
      const r = await getSchedulingFilterOptions();
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules", filters],
    queryFn: async (): Promise<ScheduleListItem[]> => {
      const r = await listSchedules(Object.keys(filters).length ? filters : undefined);
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as ScheduleListItem[]) ?? [];
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", schoolId],
    queryFn: async (): Promise<RoomListItem[]> => {
      const r = await listRooms(schoolId || undefined);
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as RoomListItem[]) ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!termId) throw new Error("Select a term first.");
      const r = await IntelligentTimetabler(termId, programmeId || undefined);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setLastConflictReport(r.conflictReport);
      toast.success(
        `Timetable generated: ${r.created} slot(s) created.${r.conflictReport.minor.length + r.conflictReport.major.length > 0 ? " Review conflicts below." : ""}`
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generate failed"),
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolveModal) return;
      const r = await resolveScheduleConflict(resolveModal.schedule.id, {
        roomId: resolveRoomId || undefined,
        dayOfWeek: resolveDay,
        startMinutes: resolveStart,
        endMinutes: resolveEnd,
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setResolveModal(null);
      toast.success("Schedule updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const report = lastConflictReport;
  const hasConflicts = report && (report.minor.length > 0 || report.major.length > 0);

  // Build grid cells: for each day 1–5 and hour, find schedules that overlap that slot
  const gridSlots = useMemo(() => {
    const out: Array<{ day: number; hour: number; schedules: ScheduleListItem[] }> = [];
    for (const day of [1, 2, 3, 4, 5]) {
      for (const hour of HOURS) {
        const startMin = hour * 60;
        const endMin = (hour + 1) * 60;
        const schedulesInSlot = schedules.filter(
          (s) =>
            s.dayOfWeek === day && s.startMinutes < endMin && s.endMinutes > startMin
        );
        out.push({ day, hour, schedules: schedulesInSlot });
      }
    }
    return out;
  }, [schedules]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Intelligent Scheduling
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Generate conflict-free timetables for a term. Respects faculty workload, room capacity,
          student balance, and school hierarchy. Fix conflicts with one click.
        </p>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-neon-cyan" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={termId || "all"} onValueChange={(v) => setTermId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {options?.terms?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={schoolId || "all"} onValueChange={(v) => setSchoolId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {options?.schools?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={departmentId || "all"}
            onValueChange={(v) => setDepartmentId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {options?.departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={programmeId || "all"}
            onValueChange={(v) => setProgrammeId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[200px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Programme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programmes</SelectItem>
              {options?.programmes?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Generate CTA */}
      <Card className="border-neon-cyan/30 bg-space-800/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-cyan" />
                Generate Optimal Timetable
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                AI will assign rooms and times for this term, respecting workload and capacity.
              </p>
            </div>
            <Button
              className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim font-medium shrink-0"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !termId}
            >
              {generateMutation.isPending ? (
                "Generating…"
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Optimal Timetable
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conflict report */}
      {report && (report.minor.length > 0 || report.major.length > 0 || report.recommendations.length > 0) && (
        <Card className="border-amber-500/30 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Conflict report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.major.length > 0 && (
              <div>
                <p className="text-amber-400 text-sm font-medium mb-2">Major (review required)</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  {report.major.map((c, i) => (
                    <li key={i}>
                      {c.description}
                      {c.recommendation && (
                        <span className="text-slate-500 block ml-4">{c.recommendation}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.minor.length > 0 && (
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2">Minor (optional fixes)</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  {report.minor.map((c, i) => (
                    <li key={i}>
                      {c.description}
                      {c.recommendation && (
                        <span className="text-slate-500 block ml-4">{c.recommendation}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.recommendations.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-neon-cyan shrink-0 mt-0.5" />
                <ul className="list-disc list-inside space-y-1">
                  {report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timetable grid */}
      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-neon-cyan" />
            Timetable
          </CardTitle>
          <p className="text-slate-400 text-sm">
            {termId ? "Week view (Mon–Fri). Click a slot to change room or time." : "Select a term and apply filters to see the timetable."}
          </p>
        </CardHeader>
        <CardContent>
          {schedulesLoading && <p className="text-slate-400 py-8">Loading…</p>}
          {!schedulesLoading && schedules.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No schedule slots yet. Use &quot;Generate Optimal Timetable&quot; above.</p>
            </div>
          )}
          {!schedulesLoading && schedules.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-14 p-2 text-left text-slate-500 font-medium border-b border-white/10">
                      Time
                    </th>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <th
                        key={d}
                        className="p-2 text-center text-slate-500 font-medium border-b border-white/10 min-w-[140px]"
                      >
                        {DAYS[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="p-1 text-slate-500 text-xs border-r border-white/10 align-top">
                        {hour}:00
                      </td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const cell = gridSlots.find((c) => c.day === day && c.hour === hour);
                        const cellSchedules = cell?.schedules ?? [];
                        return (
                          <td
                            key={day}
                            className="p-1 align-top border-b border-white/5 min-h-[60px]"
                          >
                            {cellSchedules.map((s) => {
                              const duration = (s.endMinutes - s.startMinutes) / 60;
                              const startInHour = (s.startMinutes - hour * 60) / 60;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setResolveModal({ schedule: s, open: true });
                                    setResolveRoomId(s.roomId);
                                    setResolveDay(s.dayOfWeek);
                                    setResolveStart(s.startMinutes);
                                    setResolveEnd(s.endMinutes);
                                  }}
                                  className="w-full text-left rounded-md p-2 bg-neon-cyan/15 border border-neon-cyan/30 hover:bg-neon-cyan/25 transition-colors mb-1"
                                  style={{
                                    minHeight: `${Math.max(40, duration * 48)}px`,
                                    marginTop: startInHour > 0 ? `${startInHour * 48}px` : 0,
                                  }}
                                >
                                  <p className="font-medium text-white truncate">{s.module.title}</p>
                                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {s.room.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {minutesToLabel(s.startMinutes)}–{minutesToLabel(s.endMinutes)}
                                  </p>
                                </button>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List view + one-click fix */}
      {schedules.length > 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Wrench className="h-4 w-4 text-neon-cyan" />
              Conflict resolver
            </CardTitle>
            <p className="text-slate-400 text-sm">
              Click &quot;Fix&quot; to change room or time for a slot.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-space-900/80 border border-white/5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{s.module.title}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {s.room.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {DAYS[s.dayOfWeek]} {minutesToLabel(s.startMinutes)}–{minutesToLabel(s.endMinutes)}
                      </span>
                      {s.lecturerId && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> Lecturer
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-neon-cyan/40 text-neon-cyan shrink-0"
                    onClick={() => {
                      setResolveModal({ schedule: s, open: true });
                      setResolveRoomId(s.roomId);
                      setResolveDay(s.dayOfWeek);
                      setResolveStart(s.startMinutes);
                      setResolveEnd(s.endMinutes);
                    }}
                  >
                    Fix
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolve modal */}
      <Dialog
        open={!!resolveModal?.open}
        onOpenChange={(open) => !open && setResolveModal(null)}
      >
        <DialogContent className="bg-space-800 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Change slot</DialogTitle>
          </DialogHeader>
          {resolveModal && (
            <>
              <p className="text-slate-400 text-sm">
                {resolveModal.schedule.module.title} — adjust room or time.
              </p>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Room</label>
                  <Select value={resolveRoomId} onValueChange={setResolveRoomId}>
                    <SelectTrigger className="border-white/20 bg-space-900 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.capacity} cap)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Day</label>
                    <Select value={String(resolveDay)} onValueChange={(v) => setResolveDay(Number(v))}>
                      <SelectTrigger className="border-white/20 bg-space-900 text-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {DAYS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Start (minutes from midnight)</label>
                    <Select value={String(resolveStart)} onValueChange={(v) => setResolveStart(Number(v))}>
                      <SelectTrigger className="border-white/20 bg-space-900 text-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[480, 510, 540, 570, 600, 630, 660, 690, 720, 750, 780, 810, 840].map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {minutesToLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">End (minutes from midnight)</label>
                  <Select value={String(resolveEnd)} onValueChange={(v) => setResolveEnd(Number(v))}>
                    <SelectTrigger className="border-white/20 bg-space-900 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[570, 600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 930].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {minutesToLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveModal(null)}>
              Cancel
            </Button>
            <Button
              className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? "Saving…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
