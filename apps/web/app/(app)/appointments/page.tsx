"use client";

/**
 * Phase 17: Calendar-based appointment system.
 * My appointments, book office hours/advising slots, set office hours (faculty).
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  UserPlus,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMyAppointments,
  bookAppointment,
  setOfficeHours,
  getAvailabilitySlots,
} from "@/app/actions/appointment-actions";
import { useMe } from "@/hooks/use-me";

const APPOINTMENTS_QUERY_KEY = ["appointments"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  OFFICE_HOURS: "Office hours",
  ADVISING: "Advising",
  EXAM_REVIEW: "Exam review",
  MENTORSHIP: "Mentorship",
};

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ----- My Appointments (list + month grid) -----
function MyAppointmentsTab() {
  const queryClient = useQueryClient();
  const [monthOffset, setMonthOffset] = useState(0);

  const { data: result, isLoading, error } = useQuery({
    queryKey: [APPOINTMENTS_QUERY_KEY, monthOffset],
    queryFn: async () => {
      const start = new Date();
      start.setMonth(start.getMonth() + monthOffset);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      const r = await getMyAppointments({
        from: start,
        to: end,
      });
      if (!r.ok) throw new Error(r.error);
      return r.appointments;
    },
  });

  const appointments = result ?? [];
  const viewDate = new Date();
  viewDate.setMonth(viewDate.getMonth() + monthOffset);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const gridDays: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-white">
          My appointments
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300"
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-slate-200 min-w-[140px] text-center">
            {viewDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300"
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load appointments."}
        </p>
      )}

      {/* Month grid */}
      <div className="rounded-xl border border-white/10 bg-space-800/50 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAYS.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-xs font-medium text-slate-400 border-r border-white/10 last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {gridDays.map((day, i) => {
            const date = day === null ? null : new Date(year, month, day);
            const dayAppointments =
              date && appointments.filter((a) => {
                const d = new Date(a.startTime);
                return d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
              });
            return (
              <div
                key={i}
                className="min-h-[80px] p-2 border-r border-b border-white/10 last:border-r-0 bg-space-800/30"
              >
                {day !== null && (
                  <>
                    <span className="text-slate-400 text-sm">{day}</span>
                    {dayAppointments && dayAppointments.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayAppointments.slice(0, 2).map((a) => (
                          <div
                            key={a.id}
                            className="text-xs bg-neon-cyan/20 text-neon-cyan rounded px-1 truncate"
                            title={`${a.title} ${formatTime(a.startTime)}`}
                          >
                            {formatTime(a.startTime)} {a.title}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <span className="text-xs text-slate-500">
                            +{dayAppointments.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div>
        <h3 className="font-display text-sm font-semibold text-slate-300 mb-2">
          Upcoming
        </h3>
        {appointments.length === 0 && (
          <p className="text-slate-500 text-sm">No appointments in this month.</p>
        )}
        <div className="space-y-2">
          {appointments.slice(0, 10).map((a) => (
            <Card
              key={a.id}
              className="border-white/10 bg-space-800/50 p-3 flex flex-row items-center gap-3"
            >
              <Clock className="h-4 w-4 text-neon-cyan shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{a.title}</p>
                <p className="text-xs text-slate-400">
                  {formatDate(a.startTime)} · {formatTime(a.startTime)} – {formatTime(a.endTime)}
                  {a.location && ` · ${a.location}`}
                </p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {APPOINTMENT_TYPE_LABELS[a.type] ?? a.type}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Book a slot -----
function BookSlotTab() {
  const queryClient = useQueryClient();
  const [hostUserId, setHostUserId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const { data: hostIds = [] } = useQuery({
    queryKey: ["appointments-hosts"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/hosts");
      if (!res.ok) throw new Error("Failed to load hosts");
      const j = await res.json();
      return j.hostUserIds ?? [];
    },
  });

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["appointments-availability", hostUserId, date],
    queryFn: async () => {
      if (!hostUserId || !date) return [];
      const res = await fetch(
        `/api/appointments/availability?hostUserId=${encodeURIComponent(hostUserId)}&date=${encodeURIComponent(date)}`
      );
      if (!res.ok) return [];
      const j = await res.json();
      return (j.slots ?? []).map((s: { start: string; end: string }) => ({
        start: new Date(s.start),
        end: new Date(s.end),
      }));
    },
    enabled: !!hostUserId && !!date,
  });

  const bookMutation = useMutation({
    mutationFn: (input: {
      hostUserId: string;
      startTime: Date;
      endTime: Date;
      title: string;
      notes?: string;
    }) =>
      bookAppointment({
        hostUserId: input.hostUserId,
        startTime: input.startTime,
        endTime: input.endTime,
        title: input.title,
        type: "OFFICE_HOURS",
        notes: input.notes || null,
      }),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
        toast.success("Appointment booked.");
        setSelectedSlot(null);
        setTitle("");
        setNotes("");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to book"),
  });

  const handleBook = () => {
    if (!selectedSlot || !hostUserId || !title.trim()) {
      toast.error("Select a slot and enter a title.");
      return;
    }
    bookMutation.mutate({
      hostUserId,
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
      title: title.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-semibold text-white">
        Book office hours or advising
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Host (faculty / advisor)</Label>
          <Select value={hostUserId} onValueChange={setHostUserId}>
            <SelectTrigger className="border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="Select host…" />
            </SelectTrigger>
            <SelectContent>
              {hostIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id.slice(0, 12)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-white/20 bg-space-800 text-slate-200"
          />
        </div>
      </div>

      {hostUserId && (
        <>
          <div className="space-y-2">
            <Label className="text-slate-300">Available slots</Label>
            {loadingSlots && <p className="text-slate-500 text-sm">Loading…</p>}
            {!loadingSlots && slots.length === 0 && (
              <p className="text-slate-500 text-sm">No slots on this day.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, i) => (
                <Button
                  key={i}
                  variant={selectedSlot === slot ? "default" : "outline"}
                  size="sm"
                  className={
                    selectedSlot === slot
                      ? "bg-neon-cyan text-space-900"
                      : "border-white/20 text-slate-300"
                  }
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatTime(slot.start)} – {formatTime(slot.end)}
                </Button>
              ))}
            </div>
          </div>
          {selectedSlot && (
            <Card className="border-white/10 bg-space-800/50 p-4 space-y-3">
              <Label className="text-slate-300">Title / reason</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Office hours – project question"
                className="border-white/20 bg-transparent text-slate-200"
              />
              <Label className="text-slate-300">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="border-white/20 bg-transparent text-slate-200"
              />
              <Button
                onClick={handleBook}
                disabled={bookMutation.isPending || !title.trim()}
                className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
              >
                {bookMutation.isPending ? "Booking…" : "Book appointment"}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ----- Set office hours (recurring weekly) -----
function SetOfficeHoursTab() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [slots, setSlots] = useState<{ dayOfWeek: number; startMinutes: number; endMinutes: number }[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const { data: existingSlots = [] } = useQuery({
    queryKey: ["availability-slots", userId],
    queryFn: async () => {
      if (!userId) return [];
      const r = await getAvailabilitySlots(userId);
      if (!r.ok) return [];
      return r.slots;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (existingSlots.length > 0 && !hydrated) {
      setSlots(
        existingSlots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
        }))
      );
      setHydrated(true);
    }
  }, [existingSlots, hydrated]);

  const addSlot = () => {
    setSlots((prev) => [...prev, { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 10 * 60 }]);
  };

  // When no existing slots and not yet hydrated, show one empty row to add
  useEffect(() => {
    if (existingSlots.length === 0 && slots.length === 0 && userId) {
      setSlots([{ dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 10 * 60 }]);
      setHydrated(true);
    }
  }, [existingSlots.length, userId]);

  const updateSlot = (
    index: number,
    field: "dayOfWeek" | "startMinutes" | "endMinutes",
    value: number
  ) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: (input: { slots: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] }) =>
      setOfficeHours({ slots: input.slots }),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["availability-slots"] });
        queryClient.invalidateQueries({ queryKey: ["appointments-hosts"] });
        toast.success("Office hours updated.");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const handleSave = () => {
    const valid = slots.every(
      (s) =>
        s.dayOfWeek >= 0 &&
        s.dayOfWeek <= 6 &&
        s.startMinutes >= 0 &&
        s.endMinutes > s.startMinutes &&
        s.endMinutes <= 1440
    );
    if (!valid) {
      toast.error("Invalid slot times.");
      return;
    }
    saveMutation.mutate({ slots });
  };

  const toTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };
  const fromTime = (str: string) => {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-neon-cyan" />
        Set your office hours
      </h2>
      <p className="text-slate-400 text-sm">
        Add recurring weekly slots when you are available for office hours or advising. Students can then book into these slots.
      </p>
      <div className="space-y-3">
        {slots.map((slot, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-space-800/50 p-3"
          >
            <Select
              value={String(slot.dayOfWeek)}
              onValueChange={(v) => updateSlot(index, "dayOfWeek", Number(v))}
            >
              <SelectTrigger className="w-[130px] border-white/20 bg-transparent text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              value={toTime(slot.startMinutes)}
              onChange={(e) => updateSlot(index, "startMinutes", fromTime(e.target.value))}
              className="w-[100px] border-white/20 bg-transparent text-slate-200"
            />
            <span className="text-slate-500">–</span>
            <Input
              type="time"
              value={toTime(slot.endMinutes)}
              onChange={(e) => updateSlot(index, "endMinutes", fromTime(e.target.value))}
              className="w-[100px] border-white/20 bg-transparent text-slate-200"
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-red-400"
              onClick={() => removeSlot(index)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 text-slate-300"
          onClick={addSlot}
        >
          Add slot
        </Button>
      </div>
      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
      >
        {saveMutation.isPending ? "Saving…" : "Save office hours"}
      </Button>
    </div>
  );
}

export default function AppointmentsPage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const defaultTab =
    tabFromUrl === "office-hours" || tabFromUrl === "book" ? tabFromUrl : "my";

  const { data: me } = useMe();
  const isFaculty =
    me?.kind === "tenant" &&
    (me.role === "INSTRUCTOR" || me.role === "OWNER" || me.role === "ADMIN");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-white tracking-tight">
        Appointments
      </h1>
      <p className="text-slate-400">
        View your appointments, book office hours or advising slots, and manage your availability.
      </p>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full">
        <TabsList className="bg-space-800 border border-white/10">
          <TabsTrigger value="my" className="data-[state=active]:bg-neon-cyan data-[state=active]:text-space-900">
            <Calendar className="h-4 w-4 mr-2" /> My appointments
          </TabsTrigger>
          <TabsTrigger value="book" className="data-[state=active]:bg-neon-cyan data-[state=active]:text-space-900">
            <UserPlus className="h-4 w-4 mr-2" /> Book a slot
          </TabsTrigger>
          {isFaculty && (
            <TabsTrigger value="office-hours" className="data-[state=active]:bg-neon-cyan data-[state=active]:text-space-900">
              <Settings2 className="h-4 w-4 mr-2" /> Set office hours
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="my" className="mt-4">
          <MyAppointmentsTab />
        </TabsContent>
        <TabsContent value="book" className="mt-4">
          <BookSlotTab />
        </TabsContent>
        {isFaculty && (
          <TabsContent value="office-hours" className="mt-4">
            <SetOfficeHoursTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
