"use client";

/**
 * Phase 16: Student self-service registration portal.
 * Shows current open term, programmes with core/optional modules,
 * prerequisites validation, waitlist option, and registration status dashboard.
 * LMS-Only: simplified module registration; Hybrid/Unified: full programme-level.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCurrentOpenTerm,
  getRegistrationEnginePayload,
  submitRegistration,
  listMyRegistrations,
  type RegistrationEnginePayload,
  type ProgrammeOption,
  type ProgrammeModuleOption,
  type StudentRegistrationListItem,
} from "@/app/actions/registration-actions";
import { listAcademicTerms } from "@/app/actions/calendar-actions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ModuleRow({
  mod,
  enrolled,
  waitlist,
  onToggleEnrolled,
  onToggleWaitlist,
  disabled,
  core,
}: {
  mod: ProgrammeModuleOption;
  enrolled: boolean;
  waitlist: boolean;
  onToggleEnrolled: () => void;
  onToggleWaitlist: () => void;
  disabled: boolean;
  core: boolean;
}) {
  const canEnroll = mod.prerequisitesMet;
  return (
    <li className="flex items-center gap-3 py-1.5 pl-2 border-l-2 border-white/5">
      <input
        type="checkbox"
        checked={enrolled}
        onChange={onToggleEnrolled}
        disabled={disabled || !canEnroll}
        className="rounded border-white/30 bg-white/5 text-neon-cyan focus:ring-neon-cyan"
      />
      <div className="flex-1 min-w-0">
        <span className="text-slate-200">{mod.title}</span>
        <span className="text-slate-500 text-sm ml-2">{mod.credits} cr</span>
        {!canEnroll && (
          <span className="text-amber-400 text-xs ml-2">Prerequisites not met</span>
        )}
      </div>
      {!core && (
        <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={waitlist}
            onChange={onToggleWaitlist}
            disabled={disabled || !canEnroll}
            className="rounded border-white/30 bg-white/5 text-neon-cyan"
          />
          Waitlist
        </label>
      )}
    </li>
  );
}

function ProgrammeBlock({
  prog,
  selectedIds,
  waitlistIds,
  onToggleEnrolled,
  onToggleWaitlist,
  disabled,
}: {
  prog: ProgrammeOption;
  selectedIds: Set<string>;
  waitlistIds: Set<string>;
  onToggleEnrolled: (id: string, core: boolean) => void;
  onToggleWaitlist: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const coreModules = prog.modules.filter((m) => m.isCore);
  const optionalModules = prog.modules.filter((m) => !m.isCore);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <button type="button" className="p-0.5 rounded hover:bg-white/10 text-slate-400">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <BookOpen className="h-5 w-5 text-neon-cyan shrink-0" />
        <div className="flex-1">
          <span className="font-display font-semibold text-white">{prog.name}</span>
          <span className="text-slate-400 ml-2">{prog.code}</span>
          <span className="text-slate-500 text-sm ml-2">{prog.credits} cr · {prog.departmentName}</span>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {coreModules.length > 0 && (
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-xs mb-2">Core modules</p>
              <ul className="space-y-2">
                {coreModules.map((mod) => (
                  <ModuleRow
                    key={mod.id}
                    mod={mod}
                    enrolled={selectedIds.has(mod.id)}
                    waitlist={waitlistIds.has(mod.id)}
                    onToggleEnrolled={() => onToggleEnrolled(mod.id, true)}
                    onToggleWaitlist={() => onToggleWaitlist(mod.id)}
                    disabled={disabled}
                    core
                  />
                ))}
              </ul>
            </div>
          )}
          {optionalModules.length > 0 && (
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-xs mb-2">Optional modules</p>
              <ul className="space-y-2">
                {optionalModules.map((mod) => (
                  <ModuleRow
                    key={mod.id}
                    mod={mod}
                    enrolled={selectedIds.has(mod.id)}
                    waitlist={waitlistIds.has(mod.id)}
                    onToggleEnrolled={() => onToggleEnrolled(mod.id, false)}
                    onToggleWaitlist={() => onToggleWaitlist(mod.id)}
                    disabled={disabled}
                    core={false}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegistrationPage() {
  const queryClient = useQueryClient();
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Record<string, Set<string>>>({});
  const [waitlistIds, setWaitlistIds] = useState<Record<string, Set<string>>>({});

  const { data: openTermResult } = useQuery({
    queryKey: ["registration", "current-term"],
    queryFn: () => getCurrentOpenTerm(),
  });
  const openTerm =
    openTermResult && "term" in openTermResult ? openTermResult.term : null;

  const { data: termsList } = useQuery({
    queryKey: ["academic-terms-list"],
    queryFn: async () => {
      const r = await listAcademicTerms();
      if (r && "ok" in r && !r.ok) return [];
      return (r as { id: string; name: string; type: string; startDate: Date; endDate: Date; registrationOpenDate: Date | null; registrationCloseDate: Date | null }[]) ?? [];
    },
  });

  const termIdToUse = selectedTermId || openTerm?.id || (termsList && termsList[0]?.id) || null;

  const { data: payload, isLoading: payloadLoading } = useQuery({
    queryKey: ["registration", "payload", termIdToUse],
    queryFn: () => getRegistrationEnginePayload(termIdToUse!),
    enabled: !!termIdToUse,
  });

  const { data: myRegistrations, isLoading: listLoading } = useQuery({
    queryKey: ["registration", "my-registrations"],
    queryFn: async () => {
      const r = await listMyRegistrations();
      if (r && "ok" in r && !r.ok) return [];
      return (r as StudentRegistrationListItem[]) ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: (input: { termId: string; programmeId: string; enrolledModuleIds: string[]; waitlistModuleIds?: string[] }) =>
      submitRegistration(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["registration"] });
        toast.success(r.status === "APPROVED" ? "Registration approved." : "Registration submitted.");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to submit"),
  });

  const p = payload && !("ok" in payload) ? (payload as RegistrationEnginePayload) : null;
  const registrationOpen = p?.registrationOpen ?? false;

  useEffect(() => {
    if (!p?.existingRegistration) return;
    const progId = p.existingRegistration.programmeId;
    setSelectedProgrammeId(progId);
    setEnrolledIds((prev) => ({
      ...prev,
      [progId]: new Set(p.existingRegistration!.enrolledModuleIds),
    }));
    setWaitlistIds((prev) => ({
      ...prev,
      [progId]: new Set(p.existingRegistration!.waitlistModuleIds),
    }));
  }, [p?.existingRegistration?.programmeId, p?.existingRegistration?.enrolledModuleIds?.length]);

  const handleSubmit = (programmeId: string) => {
    if (!termIdToUse || !p) return;
    const enrolled = Array.from(enrolledIds[programmeId] || []);
    const waitlist = Array.from(waitlistIds[programmeId] || []);
    if (enrolled.length === 0) {
      toast.error("Select at least one module to enroll.");
      return;
    }
    submitMutation.mutate({
      termId: termIdToUse,
      programmeId: programmeId,
      enrolledModuleIds: enrolled,
      waitlistModuleIds: waitlist,
    });
  };

  const handleToggleEnrolled = (progId: string, modId: string, isCore: boolean) => {
    setEnrolledIds((prev) => {
      const set = new Set(prev[progId] || []);
      if (set.has(modId)) set.delete(modId);
      else set.add(modId);
      return { ...prev, [progId]: set };
    });
    setSelectedProgrammeId(progId);
  };

  const handleToggleWaitlist = (progId: string, modId: string) => {
    setWaitlistIds((prev) => {
      const set = new Set(prev[progId] || []);
      if (set.has(modId)) set.delete(modId);
      else set.add(modId);
      return { ...prev, [progId]: set };
    });
  };

  return (
    <div className="min-h-screen bg-grid-pattern bg-space-950 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">
          Registration
        </h1>
        <p className="text-slate-400 mt-1">
          Register for programmes and modules for the current term. Core modules are required; optional modules can be added or waitlisted.
        </p>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="font-display text-lg font-semibold text-white mb-3">Academic term</h2>
          {openTerm ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-400 font-medium">{openTerm.name}</span>
              <span className="text-slate-400">{openTerm.type.replace("_", " ")}</span>
              {p?.registrationClosesAt && (
                <span className="text-slate-500 text-sm">
                  Registration closes {formatDate(p.registrationClosesAt)}
                </span>
              )}
              {registrationOpen ? (
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-1 text-xs font-medium">
                  Open
                </span>
              ) : (
                <span className="rounded-full bg-slate-500/20 text-slate-400 px-2.5 py-1 text-xs">
                  Closed
                </span>
              )}
              {termsList && termsList.length > 1 && (
                <select
                  value={termIdToUse || ""}
                  onChange={(e) => setSelectedTermId(e.target.value || null)}
                  className="rounded-lg border border-white/20 bg-white/5 text-slate-200 px-3 py-2 text-sm"
                >
                  {termsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatDate(t.startDate)} – {formatDate(t.endDate)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="text-slate-500">
              No registration window is currently open. Check back later or contact your institution.
            </p>
          )}
        </div>

        {termIdToUse && payloadLoading && (
          <div className="mt-6 flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading programmes…
          </div>
        )}

        {p && p.programmes.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-white mb-3">Programmes & modules</h2>
            <p className="text-slate-400 text-sm mb-4">
              {p.deploymentMode === "LMS"
                ? "Select modules you want to take this term."
                : "Choose a programme and select core and optional modules. Prerequisites must be met."}
            </p>
            <div className="space-y-4">
              {p.programmes.map((prog) => (
                <ProgrammeBlock
                  key={prog.id}
                  prog={prog}
                  selectedIds={enrolledIds[prog.id] || new Set()}
                  waitlistIds={waitlistIds[prog.id] || new Set()}
                  onToggleEnrolled={(id, core) => handleToggleEnrolled(prog.id, id, core)}
                  onToggleWaitlist={(id) => handleToggleWaitlist(prog.id, id)}
                  disabled={!registrationOpen || submitMutation.isPending}
                />
              ))}
            </div>
            {selectedProgrammeId && registrationOpen && (
              <div className="mt-6 flex items-center gap-4">
                <Button
                  className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                  disabled={submitMutation.isPending}
                  onClick={() => handleSubmit(selectedProgrammeId)}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Submit registration
                </Button>
                {p.existingRegistration && (
                  <span className="text-slate-500 text-sm">
                    You have an existing registration for this term. Submitting will update it.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {p && p.programmes.length === 0 && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6 text-center text-slate-400">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p>No programmes available for this term.</p>
          </div>
        )}

        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold text-white mb-3">My registrations</h2>
          {listLoading && <p className="text-slate-400">Loading…</p>}
          {myRegistrations && myRegistrations.length === 0 && (
            <p className="text-slate-500">You have no registrations yet.</p>
          )}
          {myRegistrations && myRegistrations.length > 0 && (
            <div className="space-y-3">
              {myRegistrations.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-4"
                >
                  <div>
                    <span className="font-medium text-white">{r.termName}</span>
                    <span className="text-slate-400 ml-2">{r.programmeName}</span>
                    <span className="text-slate-500 text-sm ml-2">{r.programmeCode}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : r.status === "REJECTED"
                          ? "bg-red-500/20 text-red-400"
                          : r.status === "WAITLISTED"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-500/20 text-slate-400"
                    }`}
                  >
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {r.submittedAt && (
                    <span className="text-slate-500 text-sm">
                      Submitted {formatDate(r.submittedAt)}
                    </span>
                  )}
                  {r.enrolledModuleIds.length > 0 && (
                    <span className="text-slate-500 text-sm">
                      {r.enrolledModuleIds.length} module(s) enrolled
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
