"use client";

/**
 * Phase 15: Organizational Hierarchy Builder.
 * Tree view: Schools (when enabled) or Faculties → Departments → Programmes.
 * Add/Edit School with Dean assignment; Add/Edit Department under School/Faculty.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  GraduationCap,
  FolderTree,
} from "lucide-react";
import { AdminShell } from "../components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createSchool,
  updateSchool,
  createDepartment,
  type CreateSchoolInput,
  type UpdateSchoolInput,
  type CreateDepartmentInput,
} from "@/app/actions/hierarchy-actions";
import type {
  HierarchyResponse,
  HierarchySchoolNode,
  HierarchyFacultyNode,
  HierarchyDepartmentNode,
  HierarchyProgrammeNode,
} from "@/app/api/hierarchy/route";
import type { OrgMember } from "@/app/api/org-members/route";

const HIERARCHY_QUERY_KEY = ["hierarchy"];

async function fetchHierarchy(): Promise<HierarchyResponse> {
  const res = await fetch("/api/hierarchy");
  if (!res.ok) throw new Error("Failed to fetch hierarchy");
  return res.json();
}

async function fetchOrgMembers(q?: string): Promise<OrgMember[]> {
  const url = q ? `/api/org-members?q=${encodeURIComponent(q)}` : "/api/org-members";
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

// ----- Tree node components -----

function ProgrammeRow({ p }: { p: HierarchyProgrammeNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-12 text-sm text-slate-300">
      <GraduationCap className="h-4 w-4 text-slate-500 shrink-0" />
      <span className="font-medium text-slate-200">{p.name}</span>
      <span className="text-slate-500">{p.code}</span>
      <span className="text-slate-500 text-xs">{p.credits} cr · {p._count.modules} modules</span>
    </div>
  );
}

function DepartmentRow({
  d,
  onAddDepartment,
  onEditDepartment,
  canEdit,
}: {
  d: HierarchyDepartmentNode;
  onAddDepartment?: (parentId: string, parentType: "school" | "faculty") => void;
  onEditDepartment?: (d: HierarchyDepartmentNode) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = d.programmes.length > 0;
  return (
    <div className="border-l border-white/10 ml-4 pl-2">
      <div className="flex items-center gap-2 py-2 group">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-0.5 rounded hover:bg-white/10 text-slate-400"
        >
          {hasChildren ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <span className="w-4 inline-block" />}
        </button>
        <FolderTree className="h-4 w-4 text-neon-cyan/70 shrink-0" />
        <span className="font-medium text-slate-200">{d.name}</span>
        {d.code && <span className="text-slate-500 text-sm">{d.code}</span>}
        {canEdit && (
          <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            {onEditDepartment && (
              <Button variant="ghost" size="sm" className="h-7 text-slate-400 hover:text-white" onClick={() => onEditDepartment(d)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        )}
      </div>
      {open && (
        <div className="space-y-0">
          {d.programmes.map((p) => (
            <ProgrammeRow key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolBlock({
  s,
  onEditSchool,
  onAddDepartment,
  canEdit,
}: {
  s: HierarchySchoolNode;
  onEditSchool: (s: HierarchySchoolNode) => void;
  onAddDepartment: (schoolId: string) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden mb-4">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <button type="button" className="p-0.5 rounded hover:bg-white/10 text-slate-400">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <Building2 className="h-5 w-5 text-neon-cyan shrink-0" />
        <div className="flex-1">
          <span className="font-display font-semibold text-white">{s.name}</span>
          <span className="text-slate-400 ml-2">{s.code}</span>
          {s.deanId && <span className="text-slate-500 text-sm ml-2">· Dean assigned</span>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="border-neon-cyan/40 text-neon-cyan" onClick={() => onAddDepartment(s.id)}>
              <Plus className="h-4 w-4 mr-1" /> Department
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => onEditSchool(s)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            {s.departments.length === 0 ? (
              <p className="text-slate-500 text-sm py-3">No departments. Add one above.</p>
            ) : (
              s.departments.map((d) => (
                <DepartmentRow
                  key={d.id}
                  d={d}
                  canEdit={canEdit}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FacultyBlock({
  f,
  onAddDepartment,
  canEdit,
}: {
  f: HierarchyFacultyNode;
  onAddDepartment: (facultyId: string) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden mb-4">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/5 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <button type="button" className="p-0.5 rounded hover:bg-white/10 text-slate-400">
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <Building2 className="h-5 w-5 text-neon-purple/70 shrink-0" />
        <div className="flex-1">
          <span className="font-display font-semibold text-white">{f.name}</span>
          {f.code && <span className="text-slate-400 ml-2">{f.code}</span>}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="border-neon-purple/40 text-neon-purple" onClick={(e) => { e.stopPropagation(); onAddDepartment(f.id); }}>
            <Plus className="h-4 w-4 mr-1" /> Department
          </Button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4"
          >
            {f.departments.length === 0 ? (
              <p className="text-slate-500 text-sm py-3">No departments.</p>
            ) : (
              f.departments.map((d) => (
                <DepartmentRow key={d.id} d={d} canEdit={canEdit} />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----- Modals -----

function SchoolFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  isLoading,
  orgMembers,
  onSearchMembers,
}: {
  open: boolean;
  onClose: () => void;
  initial?: HierarchySchoolNode | null;
  onSubmit: (data: CreateSchoolInput | UpdateSchoolInput) => void;
  isLoading: boolean;
  orgMembers: OrgMember[];
  onSearchMembers: (q: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [deanId, setDeanId] = useState<string | null>(initial?.deanId ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCode(initial?.code ?? "");
    setDeanId(initial?.deanId ?? null);
    setDescription(initial?.description ?? "");
  }, [open, initial]);

  useEffect(() => {
    const t = setTimeout(() => onSearchMembers(memberSearch), 200);
    return () => clearTimeout(t);
  }, [memberSearch, onSearchMembers]);

  const isEdit = !!initial && "id" in initial;
  const handleSubmit = () => {
    if (isEdit && initial && "id" in initial) {
      onSubmit({ schoolId: initial.id, name: name.trim(), code: code.trim().toUpperCase(), deanId, description: description.trim() || null });
    } else {
      onSubmit({ name: name.trim(), code: code.trim().toUpperCase(), deanId: deanId ?? undefined, description: description.trim() || undefined });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="font-display text-white">{isEdit ? "Edit School" : "Add School"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-slate-400">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/20 bg-transparent text-slate-200" placeholder="e.g. School of Engineering" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="border-white/20 bg-transparent text-slate-200" placeholder="e.g. ENG" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Dean (optional)</Label>
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="border-white/20 bg-transparent text-slate-200 mb-2"
            />
            <Select value={deanId ?? ""} onValueChange={(v) => setDeanId(v || null)}>
              <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                <SelectValue placeholder="Select dean" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {orgMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="border-white/20 bg-transparent text-slate-200 resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim() || !code.trim()} className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim">
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentFormModal({
  open,
  onClose,
  faculties,
  schoolId,
  facultyId: initialFacultyId,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  faculties: HierarchyFacultyNode[];
  schoolId?: string | null;
  facultyId?: string;
  onSubmit: (data: CreateDepartmentInput) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [facultyId, setFacultyId] = useState(initialFacultyId ?? faculties[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setFacultyId(initialFacultyId ?? faculties[0]?.id ?? "");
  }, [open, initialFacultyId, faculties]);

  const handleSubmit = () => {
    onSubmit({ facultyId, schoolId: schoolId ?? undefined, name: name.trim(), code: code.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-space-800 text-slate-200">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Add Department</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {faculties.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-400">Faculty</Label>
              <Select value={facultyId} onValueChange={setFacultyId}>
                <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-slate-400">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/20 bg-transparent text-slate-200" placeholder="e.g. Computer Science" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Code (optional)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="border-white/20 bg-transparent text-slate-200" placeholder="e.g. CS" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-300 hover:text-white">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim() || !facultyId} className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Page -----

export default function HierarchyPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: HIERARCHY_QUERY_KEY,
    queryFn: fetchHierarchy,
  });

  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [schoolModal, setSchoolModal] = useState<"add" | HierarchySchoolNode | null>(null);
  const [departmentModal, setDepartmentModal] = useState<{ schoolId?: string; facultyId?: string } | null>(null);

  const canEdit = true; // In real app derive from role (OWNER/ADMIN)

  const createSchoolMutation = useMutation({
    mutationFn: (input: CreateSchoolInput) => createSchool(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: HIERARCHY_QUERY_KEY });
        toast.success("School created");
        setSchoolModal(null);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create school"),
  });

  const updateSchoolMutation = useMutation({
    mutationFn: (input: UpdateSchoolInput) => updateSchool(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: HIERARCHY_QUERY_KEY });
        toast.success("School updated");
        setSchoolModal(null);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update school"),
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: HIERARCHY_QUERY_KEY });
        toast.success("Department created");
        setDepartmentModal(null);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create department"),
  });

  const loadOrgMembers = (q: string) => {
    fetchOrgMembers(q).then(setOrgMembers);
  };

  useEffect(() => {
    if (schoolModal) fetchOrgMembers("").then(setOrgMembers);
  }, [schoolModal]);

  const handleSchoolSubmit = (payload: CreateSchoolInput | UpdateSchoolInput) => {
    if ("schoolId" in payload) {
      updateSchoolMutation.mutate(payload);
    } else {
      createSchoolMutation.mutate(payload as CreateSchoolInput);
    }
  };

  const handleDepartmentSubmit = (payload: CreateDepartmentInput) => {
    createDepartmentMutation.mutate(payload);
  };

  return (
    <AdminShell activeNav="hierarchy">
      <div className="min-h-screen bg-grid-pattern bg-space-950">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Organizational Hierarchy
          </h1>
          <p className="text-slate-400 mt-1">
            {data?.schoolsEnabled
              ? "Schools → Departments → Programmes. Add or edit schools and departments below. Role assignment can scope by school (see Users & roles when schools_enabled)."
              : "Faculties → Departments → Programmes. Enable Schools in tenant settings to use the Schools layer."}
          </p>
        </div>

        {isLoading && <div className="text-slate-400">Loading hierarchy…</div>}
        {error && <div className="text-amber-400">Failed to load hierarchy. Try again.</div>}

        {data && !isLoading && (
          <>
            {data.schoolsEnabled && (
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="font-display text-lg font-semibold text-white">Schools</h2>
                {canEdit && (
                  <Button className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim" onClick={() => setSchoolModal("add")}>
                    <Plus className="h-4 w-4 mr-2" /> Add School
                  </Button>
                )}
              </div>
            )}

            {data.schoolsEnabled && data.schools.length > 0 && (
              <div className="space-y-0">
                {data.schools.map((s) => (
                  <SchoolBlock
                    key={s.id}
                    s={s}
                    onEditSchool={(sch) => setSchoolModal(sch)}
                    onAddDepartment={(schoolId) => setDepartmentModal({ schoolId, facultyId: undefined })}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            )}

            {data.schoolsEnabled && data.schools.length === 0 && canEdit && (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-slate-400">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-60" />
                <p>No schools yet. Click &quot;Add School&quot; to create one.</p>
              </div>
            )}

            {!data.schoolsEnabled && data.faculties.length > 0 && (
              <>
                <h2 className="font-display text-lg font-semibold text-white mb-4">Faculties</h2>
                {data.faculties.map((f) => (
                  <FacultyBlock
                    key={f.id}
                    f={f}
                    onAddDepartment={(facultyId) => setDepartmentModal({ facultyId })}
                    canEdit={canEdit}
                  />
                ))}
              </>
            )}

            {!data.schoolsEnabled && data.faculties.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-slate-400">
                <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-60" />
                <p>No faculties yet. Create faculties and departments via API or SIS settings.</p>
              </div>
            )}
          </>
        )}

        <SchoolFormModal
          open={schoolModal !== null && (schoolModal === "add" || "id" in schoolModal)}
          onClose={() => setSchoolModal(null)}
          initial={schoolModal !== "add" && schoolModal !== null && "id" in schoolModal ? schoolModal : null}
          onSubmit={handleSchoolSubmit}
          isLoading={createSchoolMutation.isPending || updateSchoolMutation.isPending}
          orgMembers={orgMembers}
          onSearchMembers={loadOrgMembers}
        />

        <DepartmentFormModal
          open={departmentModal !== null}
          onClose={() => setDepartmentModal(null)}
          faculties={data?.faculties ?? []}
          schoolId={departmentModal?.schoolId}
          facultyId={departmentModal?.facultyId}
          onSubmit={handleDepartmentSubmit}
          isLoading={createDepartmentMutation.isPending}
        />
      </div>
    </AdminShell>
  );
}
