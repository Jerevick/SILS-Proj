"use client";

/**
 * Phase 16: Academic Calendar manager.
 * Add/edit terms, set registration windows, visual timeline.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AdminShell } from "../components/admin-shell";
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
  createAcademicTerm,
  updateAcademicTerm,
  listAcademicTerms,
  type CreateAcademicTermInput,
  type UpdateAcademicTermInput,
  type AcademicTermListItem,
} from "@/app/actions/calendar-actions";
import type { AcademicTermType, AcademicTermStatus } from "@prisma/client";

const TERMS_QUERY_KEY = ["academic-terms"];

const TERM_TYPE_LABELS: Record<AcademicTermType, string> = {
  SEMESTER: "Semester",
  TRIMESTER: "Trimester",
  ACADEMIC_YEAR: "Academic Year",
  QUARTER: "Quarter",
};

const TERM_STATUS_LABELS: Record<AcademicTermStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  REGISTRATION_OPEN: "Registration open",
  REGISTRATION_CLOSED: "Registration closed",
  ONGOING: "Ongoing",
  ENDED: "Ended",
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TermCard({
  term,
  onEdit,
}: {
  term: AcademicTermListItem;
  onEdit: (t: AcademicTermListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const regOpen = term.registrationOpenDate && term.registrationCloseDate;
  const now = new Date();
  const isRegWindow =
    regOpen &&
    now >= new Date(term.registrationOpenDate) &&
    now <= new Date(term.registrationCloseDate!);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <button type="button" className="p-0.5 rounded hover:bg-white/10 text-slate-400">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <CalendarDays className="h-5 w-5 text-neon-cyan shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-display font-semibold text-white">{term.name}</span>
          <span className="text-slate-400 ml-2">{TERM_TYPE_LABELS[term.type]}</span>
          <span className="text-slate-500 text-sm ml-2">
            {formatDate(term.startDate)} – {formatDate(term.endDate)}
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isRegWindow
              ? "bg-emerald-500/20 text-emerald-400"
              : term.status === "ENDED"
                ? "bg-slate-500/20 text-slate-400"
                : "bg-neon-cyan/20 text-neon-cyan"
          }`}
        >
          {isRegWindow ? "Registration open" : TERM_STATUS_LABELS[term.status]}
        </span>
        {term._count && term._count.studentRegistrations > 0 && (
          <span className="text-slate-500 text-sm">
            {term._count.studentRegistrations} registration(s)
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(term);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 uppercase tracking-wider text-xs mb-1">Term dates</p>
                <p className="text-slate-200">
                  {formatDate(term.startDate)} – {formatDate(term.endDate)}
                </p>
              </div>
              {term.registrationOpenDate && term.registrationCloseDate && (
                <div>
                  <p className="text-slate-500 uppercase tracking-wider text-xs mb-1">
                    Registration window
                  </p>
                  <p className="text-slate-200">
                    {formatDate(term.registrationOpenDate)} –{" "}
                    {formatDate(term.registrationCloseDate)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden flex">
              {term.registrationOpenDate && term.registrationCloseDate && (
                <div
                  className="bg-emerald-500/40"
                  style={{ width: "30%", marginLeft: "0%" }}
                  title="Registration window"
                />
              )}
              <div className="bg-neon-cyan/50 flex-1" title="Term period" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TermFormModal({
  open,
  onClose,
  initial,
  onSubmitCreate,
  onSubmitUpdate,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  initial: AcademicTermListItem | null;
  onSubmitCreate: (data: CreateAcademicTermInput) => void;
  onSubmitUpdate: (data: UpdateAcademicTermInput) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AcademicTermType>("SEMESTER");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationOpenDate, setRegistrationOpenDate] = useState("");
  const [registrationCloseDate, setRegistrationCloseDate] = useState("");
  const [status, setStatus] = useState<AcademicTermStatus>("DRAFT");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setStartDate(
        initial.startDate instanceof Date
          ? initial.startDate.toISOString().slice(0, 10)
          : String(initial.startDate).slice(0, 10)
      );
      setEndDate(
        initial.endDate instanceof Date
          ? initial.endDate.toISOString().slice(0, 10)
          : String(initial.endDate).slice(0, 10)
      );
      setRegistrationOpenDate(
        initial.registrationOpenDate
          ? (initial.registrationOpenDate instanceof Date
              ? initial.registrationOpenDate
              : new Date(initial.registrationOpenDate)
            ).toISOString().slice(0, 10)
          : ""
      );
      setRegistrationCloseDate(
        initial.registrationCloseDate
          ? (initial.registrationCloseDate instanceof Date
              ? initial.registrationCloseDate
              : new Date(initial.registrationCloseDate)
            ).toISOString().slice(0, 10)
          : ""
      );
      setStatus(initial.status);
    } else {
      setName("");
      setType("SEMESTER");
      setStartDate("");
      setEndDate("");
      setRegistrationOpenDate("");
      setRegistrationCloseDate("");
      setStatus("DRAFT");
    }
  }, [open, initial]);

  const handleSubmit = () => {
    if (initial) {
      onSubmitUpdate({
        termId: initial.id,
        name: name.trim(),
        type,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        registrationOpenDate: registrationOpenDate || null,
        registrationCloseDate: registrationCloseDate || null,
        status,
      });
    } else {
      if (!name.trim() || !startDate || !endDate) {
        toast.error("Name, start date, and end date are required.");
        return;
      }
      onSubmitCreate({
        name: name.trim(),
        type,
        startDate,
        endDate,
        registrationOpenDate: registrationOpenDate || null,
        registrationCloseDate: registrationCloseDate || null,
        status,
      });
    }
    onClose();
  };

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="font-display text-white">
            {isEdit ? "Edit term" : "Add academic term"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-slate-400">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-white/20 bg-transparent text-slate-200"
              placeholder="e.g. Fall 2025"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AcademicTermType)}>
              <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TERM_TYPE_LABELS) as AcademicTermType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TERM_TYPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">End date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Registration window (optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 text-xs">Open</Label>
                <Input
                  type="date"
                  value={registrationOpenDate}
                  onChange={(e) => setRegistrationOpenDate(e.target.value)}
                  className="border-white/20 bg-transparent text-slate-200 mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Close</Label>
                <Input
                  type="date"
                  value={registrationCloseDate}
                  onChange={(e) => setRegistrationCloseDate(e.target.value)}
                  className="border-white/20 bg-transparent text-slate-200 mt-1"
                />
              </div>
            </div>
          </div>
          {isEdit && (
            <div className="space-y-2">
              <Label className="text-slate-400">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AcademicTermStatus)}>
                <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TERM_STATUS_LABELS) as AcademicTermStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TERM_STATUS_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim() || (!initial && (!startDate || !endDate))}
            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AcademicCalendarPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<"add" | AcademicTermListItem | null>(null);

  const { data: terms, isLoading, error } = useQuery({
    queryKey: TERMS_QUERY_KEY,
    queryFn: async () => {
      const result = await listAcademicTerms();
      if (result && "ok" in result && !result.ok) throw new Error(result.error);
      return (result as AcademicTermListItem[]) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAcademicTermInput) => createAcademicTerm(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: TERMS_QUERY_KEY });
        toast.success("Term created");
        setModalState(null);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create term"),
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateAcademicTermInput) => updateAcademicTerm(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: TERMS_QUERY_KEY });
        toast.success("Term updated");
        setModalState(null);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update term"),
  });

  const handleCreate = (data: CreateAcademicTermInput) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: UpdateAcademicTermInput) => {
    updateMutation.mutate(data);
  };

  return (
    <AdminShell activeNav="calendar">
      <div className="min-h-screen bg-grid-pattern bg-space-950">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Academic Calendar
          </h1>
          <p className="text-slate-400 mt-1">
            Manage terms (semester, trimester, academic year, quarter), set registration windows, and view the timeline.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="font-display text-lg font-semibold text-white">Terms</h2>
          <Button
            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
            onClick={() => setModalState("add")}
          >
            <Plus className="h-4 w-4 mr-2" /> Add term
          </Button>
        </div>

        {isLoading && <div className="text-slate-400">Loading terms…</div>}
        {error && (
          <div className="text-amber-400">
            {error instanceof Error ? error.message : "Failed to load terms."}
          </div>
        )}

        {terms && terms.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-slate-400">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p>No academic terms yet. Click &quot;Add term&quot; to create one.</p>
          </div>
        )}

        {terms && terms.length > 0 && (
          <div className="space-y-4">
            {terms.map((term) => (
              <TermCard
                key={term.id}
                term={term}
                onEdit={(t) => setModalState(t)}
              />
            ))}
          </div>
        )}

        <TermFormModal
          open={modalState !== null}
          onClose={() => setModalState(null)}
          initial={modalState !== "add" && modalState !== null ? modalState : null}
          onSubmitCreate={handleCreate}
          onSubmitUpdate={handleUpdate}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </AdminShell>
  );
}
