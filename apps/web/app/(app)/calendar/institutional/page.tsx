"use client";

/**
 * Phase 28: Institutional Events & Activities Calendar.
 * Full institutional calendar view (monthly + weekly list), filters, Create Event with clash prevention.
 * Roles: Registrar, Dean, HoD, Event Coordinator.
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Plus,
  List,
  LayoutGrid,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getInstitutionalCalendar,
  createInstitutionalEvent,
  checkEventClash,
  listSchoolsForCalendar,
  listDepartmentsForCalendar,
  listAcademicYearsForCalendar,
  type CreateInstitutionalEventInput,
  type InstitutionalCalendarEvent,
} from "@/app/actions/institutional-calendar-actions";
import type { InstitutionalEventType } from "@prisma/client";

const CALENDAR_QUERY_KEY = ["institutional-calendar"];
const EVENT_TYPE_LABELS: Record<InstitutionalEventType, string> = {
  meeting: "Meeting",
  workshop: "Workshop",
  ceremony: "Ceremony",
  exam: "Exam",
  social: "Social",
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const out: Date[] = [];
  const d = new Date(start);
  while (d <= last || out.length % 7 !== 0 || d.getDay() !== 0) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
    if (out.length >= 42) break;
  }
  return out;
}

function EventChip({
  event,
  onClick,
}: {
  event: InstitutionalCalendarEvent;
  onClick?: () => void;
}) {
  const typeColor: Record<InstitutionalEventType, string> = {
    meeting: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    workshop: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ceremony: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    exam: "bg-red-500/20 text-red-300 border-red-500/30",
    social: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full rounded border px-1.5 py-0.5 text-xs truncate ${typeColor[event.type]} hover:opacity-90`}
      title={`${event.title} · ${formatTime(event.startTime)}–${formatTime(event.endTime)}`}
    >
      {formatTime(event.startTime)} {event.title}
    </button>
  );
}

export default function InstitutionalCalendarPage() {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [academicYear, setAcademicYear] = useState(currentDate.getFullYear());
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<InstitutionalEventType | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const viewDate = useMemo(() => {
    const d = new Date(academicYear, currentDate.getMonth() + monthOffset, 1);
    return d;
  }, [academicYear, monthOffset]);

  const { data: calendarData, isLoading, error } = useQuery({
    queryKey: [CALENDAR_QUERY_KEY, academicYear, schoolId, departmentId, eventType],
    queryFn: async () => {
      const r = await getInstitutionalCalendar({
        academicYear,
        schoolId: schoolId ?? undefined,
        departmentId: departmentId ?? undefined,
        eventType: eventType ?? undefined,
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const { data: schools } = useQuery({
    queryKey: ["calendar-schools"],
    queryFn: async () => {
      const r = await listSchoolsForCalendar();
      return Array.isArray(r) ? r : [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["calendar-departments", schoolId],
    queryFn: async () => {
      const r = await listDepartmentsForCalendar({ schoolId: schoolId ?? undefined });
      return Array.isArray(r) ? r : [];
    },
  });

  const { data: years } = useQuery({
    queryKey: ["calendar-years"],
    queryFn: async () => {
      const r = await listAcademicYearsForCalendar();
      return Array.isArray(r) ? r : [currentDate.getFullYear()];
    },
  });

  const events = calendarData?.events ?? [];
  const eventsByDay = useMemo(() => {
    const map = new Map<string, InstitutionalCalendarEvent[]>();
    for (const e of events) {
      const day = new Date(e.startTime).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return map;
  }, [events]);

  const monthDays = useMemo(
    () => getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateInstitutionalEventInput) =>
      createInstitutionalEvent(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["calendar-years"] });
        toast.success("Event created and added to the annual calendar.");
        setCreateOpen(false);
      } else {
        toast.error(r.error);
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to create event"),
  });

  return (
    <div className="min-h-screen bg-grid-pattern bg-space-950 text-slate-200">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Institutional Events & Activities
          </h1>
          <p className="text-slate-400 mt-0.5 text-sm">
            Institution-level calendar per academic year. Clash detection by department.
          </p>
        </div>
        <Button
          className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Create New Event
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Label className="text-slate-500 text-sm">Year</Label>
          <Select
            value={String(academicYear)}
            onValueChange={(v) => setAcademicYear(Number(v))}
          >
            <SelectTrigger className="w-[100px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(years?.length ? years : [currentDate.getFullYear(), currentDate.getFullYear() - 1]).map(
                (y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-slate-500 text-sm">School</Label>
          <Select
            value={schoolId ?? "all"}
            onValueChange={(v) => setSchoolId(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[160px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All schools</SelectItem>
              {(schools ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-slate-500 text-sm">Department</Label>
          <Select
            value={departmentId ?? "all"}
            onValueChange={(v) => setDepartmentId(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[180px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {(departments ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-slate-500 text-sm">Type</Label>
          <Select
            value={eventType ?? "all"}
            onValueChange={(v) =>
              setEventType(v === "all" ? null : (v as InstitutionalEventType))
            }
          >
            <SelectTrigger className="w-[120px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(EVENT_TYPE_LABELS) as InstitutionalEventType[]).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {EVENT_TYPE_LABELS[k]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5">
          <Button
            variant={viewMode === "month" ? "secondary" : "ghost"}
            size="sm"
            className={viewMode === "month" ? "bg-white/10" : "text-slate-400"}
            onClick={() => setViewMode("month")}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Month
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className={viewMode === "list" ? "bg-white/10" : "text-slate-400"}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-1" /> List
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
          Loading calendar…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          {error instanceof Error ? error.message : "Failed to load calendar."}
        </div>
      )}

      {!isLoading && !error && viewMode === "month" && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => setMonthOffset((m) => m - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-display font-semibold text-white">
              {viewDate.toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => setMonthOffset((m) => m + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-slate-500 text-xs uppercase tracking-wider border-b border-white/10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-2 text-center">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
            {monthDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isCurrentMonth =
                d.getMonth() === viewDate.getMonth() &&
                d.getFullYear() === viewDate.getFullYear();
              return (
                <div
                  key={key}
                  className={`min-h-[80px] border-b border-r border-white/5 p-1 ${
                    isCurrentMonth ? "bg-transparent" : "bg-white/[0.02]"
                  }`}
                >
                  <span
                    className={`text-sm ${isCurrentMonth ? "text-slate-300" : "text-slate-600"}`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventChip key={ev.id} event={ev} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-slate-500 text-xs">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && !error && viewMode === "list" && (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="divide-y divide-white/10">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No events in this period. Create an event to add it to the annual calendar.</p>
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-white/5"
                >
                  <div className="w-24 shrink-0 text-slate-400 text-sm">
                    {formatDate(ev.startTime)}
                  </div>
                  <div className="w-28 shrink-0 text-neon-cyan text-sm">
                    {formatTime(ev.startTime)}–{formatTime(ev.endTime)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-white">{ev.title}</span>
                    <span className="ml-2 text-slate-500 text-sm">
                      {EVENT_TYPE_LABELS[ev.type]}
                      {ev.departmentName && ` · ${ev.departmentName}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(input) => createMutation.mutate(input)}
        isLoading={createMutation.isPending}
        schools={schools ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}

function CreateEventModal({
  open,
  onClose,
  onSubmit,
  isLoading,
  schools,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateInstitutionalEventInput) => void;
  isLoading: boolean;
  schools: { id: string; name: string }[];
  departments: { id: string; name: string; schoolId: string | null }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [type, setType] = useState<InstitutionalEventType>("meeting");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [clashWarning, setClashWarning] = useState<{
    clashes: { existingTitle: string; existingStart: string; existingEnd: string }[];
    aiSuggestion?: string;
  } | null>(null);
  const [clashChecking, setClashChecking] = useState(false);

  const checkClash = useCallback(async () => {
    if (!title.trim() || !startTime || !endTime || !departmentId) {
      setClashWarning(null);
      return;
    }
    setClashChecking(true);
    try {
      const r = await checkEventClash({
        title: title.trim(),
        description: description || undefined,
        startTime,
        endTime,
        type,
        schoolId: schoolId ?? undefined,
        departmentId,
        programmeId: undefined,
      });
      if (r.ok && r.hasClash && r.clashes) {
        setClashWarning({
          clashes: r.clashes.map((c) => ({
            existingTitle: c.existingTitle,
            existingStart: c.existingStart,
            existingEnd: c.existingEnd,
          })),
          aiSuggestion: r.aiSuggestion,
        });
      } else {
        setClashWarning(null);
      }
    } catch {
      setClashWarning(null);
    } finally {
      setClashChecking(false);
    }
  }, [title, description, startTime, endTime, type, schoolId, departmentId]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Start and end time are required.");
      return;
    }
    if (new Date(startTime) >= new Date(endTime)) {
      toast.error("End time must be after start time.");
      return;
    }
    if (clashWarning && clashWarning.clashes.length > 0) {
      toast.error("Resolve the clash before creating, or choose a different time/department.");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description || null,
      startTime,
      endTime,
      type,
      schoolId: schoolId ?? null,
      departmentId: departmentId ?? null,
      programmeId: null,
      status: "PUBLISHED",
    });
  };

  const runClashCheck = () => {
    if (title.trim() && startTime && endTime && departmentId) void checkClash();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="font-display text-white">
            Create New Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-slate-400">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-white/20 bg-transparent text-slate-200"
              placeholder="e.g. Department meeting"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-white/20 bg-transparent text-slate-200"
              placeholder="Brief description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Start</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setClashWarning(null);
                }}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">End</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setClashWarning(null);
                }}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as InstitutionalEventType)}
            >
              <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EVENT_TYPE_LABELS) as InstitutionalEventType[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {EVENT_TYPE_LABELS[k]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">School (optional)</Label>
            <Select
              value={schoolId ?? "none"}
              onValueChange={(v) => setSchoolId(v === "none" ? null : v)}
            >
              <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Department (optional, required for clash check)</Label>
            <Select
              value={departmentId ?? "none"}
              onValueChange={(v) => {
                setDepartmentId(v === "none" ? null : v);
                setClashWarning(null);
              }}
            >
              <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AnimatePresence>
            {clashWarning && clashWarning.clashes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-200">Clash detected</p>
                    <p className="text-slate-300 text-sm mt-0.5">
                      Same department has overlapping event(s):{" "}
                      {clashWarning.clashes.map((c) => `"${c.existingTitle}" (${formatTime(c.existingStart)}–${formatTime(c.existingEnd)})`).join("; ")}
                    </p>
                    {clashWarning.aiSuggestion && (
                      <p className="text-neon-cyan/90 text-sm mt-2 flex items-center gap-1">
                        <Sparkles className="h-4 w-4 shrink-0" />
                        {clashWarning.aiSuggestion}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-400"
            onClick={runClashCheck}
            disabled={clashChecking || !title.trim() || !startTime || !endTime || !departmentId}
          >
            {clashChecking ? "Checking…" : "Check for clashes"}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !title.trim() || !startTime || !endTime}
            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
          >
            {isLoading ? "Creating…" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
