"use server";

/**
 * Phase 24: HR & Faculty Workload Management — server actions.
 * - FacultyProfile list/get (scoped by HR Admin, Dean, HoD).
 * - CalculateFacultyWorkload: total workload + LLM_Router insights (overload alerts, balance suggestions).
 * - WorkloadAssignment CRUD (Adjust Workload).
 * - RequestLeave, ApproveLeave with notifications.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { sendNotification } from "@/app/actions/notification-actions";
import type {
  EmploymentStatus,
  WorkloadType,
  FacultyLeaveType,
  FacultyLeaveStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FacultyProfileListItem = {
  id: string;
  employeeId: string;
  userId: string;
  user: { firstName: string | null; lastName: string | null; email: string | null; clerkUserId: string };
  schoolId: string | null;
  school: { id: string; name: string } | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  maxWorkloadHours: number;
  totalHoursThisTerm?: number;
  termId?: string | null;
};

export type WorkloadBreakdownItem = {
  type: WorkloadType;
  hours: number;
  assignments: { id: string; moduleTitle: string; hoursAllocated: number }[];
};

export type CalculateFacultyWorkloadResult =
  | {
      ok: true;
      facultyId: string;
      termId: string;
      totalHours: number;
      maxWorkloadHours: number;
      breakdown: WorkloadBreakdownItem[];
      aiRecommendations: string[];
      overloadAlert: boolean;
    }
  | { ok: false; error: string };

export type FacultyLeaveListItem = {
  id: string;
  facultyId: string;
  faculty: { id: string; user: { firstName: string | null; lastName: string | null }; employeeId: string };
  leaveType: FacultyLeaveType;
  startDate: string;
  endDate: string;
  status: FacultyLeaveStatus;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers: auth and scope (HR Admin = tenant-wide; Dean = school; HoD = department)
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return {
    ok: true as const,
    userId,
    orgId,
    tenantId: tenantResult.context.tenantId,
    role: tenantResult.context.role,
  };
}

/** Build where clause for FacultyProfile based on current user's role scope. */
async function facultyScopeWhere(tenantId: string, clerkUserId: string) {
  const roleRows = await prisma.userTenantRole.findMany({
    where: { tenantId, clerkUserId },
    select: { scopeType: true, scopeId: true, role: true },
  });
  const hasTenantWide = roleRows.some((r) => r.scopeType === null && (r.role === "OWNER" || r.role === "ADMIN"));
  if (hasTenantWide) return { tenantId } as { tenantId: string; schoolId?: undefined; departmentId?: undefined };
  const schoolScope = roleRows.find((r) => r.scopeType === "SCHOOL" && r.scopeId);
  const deptScope = roleRows.find((r) => r.scopeType === "DEPARTMENT" && r.scopeId);
  if (schoolScope?.scopeId) return { tenantId, schoolId: schoolScope.scopeId };
  if (deptScope?.scopeId) return { tenantId, departmentId: deptScope.scopeId };
  return { tenantId };
}

function canManageHR(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
}

// ---------------------------------------------------------------------------
// Faculty directory
// ---------------------------------------------------------------------------

export type ListFacultyFilters = {
  schoolId?: string | null;
  departmentId?: string | null;
  termId?: string | null;
};

export async function listFacultyProfiles(
  filters?: ListFacultyFilters
): Promise<
  { ok: true; faculty: FacultyProfileListItem[] } | { ok: false; error: string }
> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const where: Record<string, unknown> = { ...scopeWhere };
  if (filters?.schoolId) where.schoolId = filters.schoolId;
  if (filters?.departmentId) where.departmentId = filters.departmentId;

  const faculty = await prisma.facultyProfile.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true, email: true, clerkUserId: true } },
      school: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      workloadAssignments: filters?.termId
        ? { where: { termId: filters.termId }, select: { hoursAllocated: true } }
        : false,
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  const list: FacultyProfileListItem[] = faculty.map((f) => {
    const totalHoursThisTerm =
      f.workloadAssignments && Array.isArray(f.workloadAssignments)
        ? (f.workloadAssignments as { hoursAllocated: number }[]).reduce((s, a) => s + a.hoursAllocated, 0)
        : undefined;
    return {
      id: f.id,
      employeeId: f.employeeId,
      userId: f.userId,
      user: f.user,
      schoolId: f.schoolId,
      school: f.school,
      departmentId: f.departmentId,
      department: f.department,
      employmentStatus: f.employmentStatus,
      hireDate: f.hireDate.toISOString().slice(0, 10),
      maxWorkloadHours: f.maxWorkloadHours,
      totalHoursThisTerm,
      termId: filters?.termId ?? null,
    };
  });
  return { ok: true, faculty: list };
}

export async function getFacultyProfile(
  facultyId: string
): Promise<
  { ok: true; profile: FacultyProfileListItem } | { ok: false; error: string }
> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const profile = await prisma.facultyProfile.findFirst({
    where: { id: facultyId, ...scopeWhere },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, clerkUserId: true } },
      school: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!profile) return { ok: false, error: "Faculty profile not found" };

  return {
    ok: true,
    profile: {
      id: profile.id,
      employeeId: profile.employeeId,
      userId: profile.userId,
      user: profile.user,
      schoolId: profile.schoolId,
      school: profile.school,
      departmentId: profile.departmentId,
      department: profile.department,
      employmentStatus: profile.employmentStatus,
      hireDate: profile.hireDate.toISOString().slice(0, 10),
      maxWorkloadHours: profile.maxWorkloadHours,
    },
  };
}

// ---------------------------------------------------------------------------
// Calculate faculty workload + AI insights (LLM_Router)
// ---------------------------------------------------------------------------

export async function calculateFacultyWorkload(
  facultyId: string,
  termId: string
): Promise<CalculateFacultyWorkloadResult> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const faculty = await prisma.facultyProfile.findFirst({
    where: { id: facultyId, ...scopeWhere },
    include: {
      user: { select: { firstName: true, lastName: true } },
      workloadAssignments: {
        where: { termId },
        include: { module: { select: { id: true, title: true } } },
      },
    },
  });
  if (!faculty) return { ok: false, error: "Faculty profile not found" };

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, tenantId: authResult.tenantId },
  });
  if (!term) return { ok: false, error: "Term not found" };

  const byType: Record<WorkloadType, { hours: number; assignments: { id: string; moduleTitle: string; hoursAllocated: number }[] }> = {
    TEACHING: { hours: 0, assignments: [] },
    RESEARCH: { hours: 0, assignments: [] },
    ADMIN: { hours: 0, assignments: [] },
    SERVICE: { hours: 0, assignments: [] },
  };

  for (const a of faculty.workloadAssignments) {
    byType[a.workloadType].hours += a.hoursAllocated;
    byType[a.workloadType].assignments.push({
      id: a.id,
      moduleTitle: a.module.title,
      hoursAllocated: a.hoursAllocated,
    });
  }

  const totalHours = Object.values(byType).reduce((s, x) => s + x.hours, 0);
  const maxWorkloadHours = faculty.maxWorkloadHours || 0;
  const overloadAlert = maxWorkloadHours > 0 && totalHours > maxWorkloadHours;

  const breakdown: WorkloadBreakdownItem[] = (Object.entries(byType) as [WorkloadType, (typeof byType)[WorkloadType]][])
    .filter(([, v]) => v.hours > 0)
    .map(([type, v]) => ({ type, hours: v.hours, assignments: v.assignments }));

  // LLM_Router: insights and recommendations
  const llmPrompt = `You are an HR workload analyst. Given the following faculty workload for one term, provide 2-4 short, actionable recommendations. Consider: overload alerts, balance between teaching/research/admin/service, and sustainability. Keep each recommendation to one sentence. Output only the recommendations, one per line, no numbering. Faculty: ${faculty.user.firstName ?? ""} ${faculty.user.lastName ?? ""}. Term: ${term.name}. Total hours: ${totalHours}. Max allowed: ${maxWorkloadHours}. Breakdown: ${JSON.stringify(breakdown)}. ${overloadAlert ? "This faculty is OVER their max workload." : ""}`;

  const llmResult = await runLLMRouter({
    systemPrompt: "You provide concise, actionable HR workload recommendations. Output plain text, one recommendation per line.",
    messages: [{ role: "user" as const, content: llmPrompt }],
    maxTokens: 400,
    cachePrefix: "hr-workload",
  });

  let aiRecommendations: string[] = [];
  if (llmResult.ok && llmResult.text) {
    aiRecommendations = llmResult.text
      .split("\n")
      .map((s) => s.replace(/^[\d.)\s-]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  if (overloadAlert && !aiRecommendations.some((r) => /overload|over load|exceed|max/i.test(r))) {
    aiRecommendations.unshift("Faculty is over their maximum allocated hours for this term. Consider redistributing teaching or admin duties.");
  }

  return {
    ok: true,
    facultyId,
    termId,
    totalHours,
    maxWorkloadHours,
    breakdown,
    aiRecommendations,
    overloadAlert,
  };
}

// ---------------------------------------------------------------------------
// Workload assignment CRUD (Adjust Workload)
// ---------------------------------------------------------------------------

export type CreateWorkloadAssignmentInput = {
  facultyId: string;
  moduleId: string;
  workloadType: WorkloadType;
  hoursAllocated: number;
  termId: string;
};

export async function createWorkloadAssignment(
  input: CreateWorkloadAssignmentInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const faculty = await prisma.facultyProfile.findFirst({
    where: { id: input.facultyId, ...scopeWhere },
  });
  if (!faculty) return { ok: false, error: "Faculty not found" };

  const term = await prisma.academicTerm.findFirst({
    where: { id: input.termId, tenantId: authResult.tenantId },
  });
  if (!term) return { ok: false, error: "Term not found" };

  const programmeModule = await prisma.programmeModule.findFirst({
    where: { id: input.moduleId },
  });
  if (!programmeModule) return { ok: false, error: "Module not found" };

  const created = await prisma.workloadAssignment.create({
    data: {
      tenantId: authResult.tenantId,
      facultyId: input.facultyId,
      moduleId: input.moduleId,
      workloadType: input.workloadType,
      hoursAllocated: input.hoursAllocated,
      termId: input.termId,
    },
  });
  return { ok: true, id: created.id };
}

export type UpdateWorkloadAssignmentInput = {
  id: string;
  hoursAllocated?: number;
  workloadType?: WorkloadType;
};

export async function updateWorkloadAssignment(
  input: UpdateWorkloadAssignmentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const existing = await prisma.workloadAssignment.findFirst({
    where: { id: input.id, tenantId: authResult.tenantId },
  });
  if (!existing) return { ok: false, error: "Assignment not found" };

  await prisma.workloadAssignment.update({
    where: { id: input.id },
    data: {
      ...(input.hoursAllocated !== undefined && { hoursAllocated: input.hoursAllocated }),
      ...(input.workloadType !== undefined && { workloadType: input.workloadType }),
    },
  });
  return { ok: true };
}

export async function deleteWorkloadAssignment(
  assignmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const deleted = await prisma.workloadAssignment.deleteMany({
    where: { id: assignmentId, tenantId: authResult.tenantId },
  });
  if (deleted.count === 0) return { ok: false, error: "Assignment not found" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Leave requests: list, request, approve (with notification)
// ---------------------------------------------------------------------------

export type ListLeavesFilters = {
  facultyId?: string | null;
  status?: FacultyLeaveStatus | null;
};

export async function listFacultyLeaves(
  filters?: ListLeavesFilters
): Promise<
  { ok: true; leaves: FacultyLeaveListItem[] } | { ok: false; error: string }
> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const facultyIds = await prisma.facultyProfile
    .findMany({
      where: scopeWhere,
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const where: { tenantId: string; facultyId?: string | { in: string[] }; status?: FacultyLeaveStatus } = {
    tenantId: authResult.tenantId,
  };
  if (filters?.facultyId) where.facultyId = filters.facultyId;
  else if (facultyIds.length > 0) where.facultyId = { in: facultyIds };
  if (filters?.status) where.status = filters.status;

  const leaves = await prisma.facultyLeave.findMany({
    where,
    include: {
      faculty: {
        select: {
          id: true,
          employeeId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    leaves: leaves.map((l) => ({
      id: l.id,
      facultyId: l.facultyId,
      faculty: l.faculty,
      leaveType: l.leaveType,
      startDate: l.startDate.toISOString().slice(0, 10),
      endDate: l.endDate.toISOString().slice(0, 10),
      status: l.status,
      approvedBy: l.approvedBy,
      notes: l.notes,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export type RequestLeaveInput = {
  leaveType: FacultyLeaveType;
  startDate: string;
  endDate: string;
  notes?: string | null;
};

/** Request leave for the current user (must have a FacultyProfile). */
export async function requestLeave(
  input: RequestLeaveInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };

  const user = await prisma.user.findUnique({
    where: { clerkUserId: authResult.userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  const profile = await prisma.facultyProfile.findUnique({
    where: { tenantId_userId: { tenantId: authResult.tenantId, userId: user.id } },
  });
  if (!profile) return { ok: false, error: "No faculty profile found for your account" };

  const created = await prisma.facultyLeave.create({
    data: {
      tenantId: authResult.tenantId,
      facultyId: profile.id,
      leaveType: input.leaveType,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      status: "PENDING",
      notes: input.notes ?? null,
    },
  });
  return { ok: true, id: created.id };
}

export async function approveLeave(
  leaveId: string,
  approved: boolean,
  notes?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (!canManageHR(authResult.role)) return { ok: false, error: "Forbidden" };

  const leave = await prisma.facultyLeave.findFirst({
    where: { id: leaveId, tenantId: authResult.tenantId },
    include: { faculty: { include: { user: { select: { clerkUserId: true } } } } },
  });
  if (!leave) return { ok: false, error: "Leave request not found" };
  if (leave.status !== "PENDING") return { ok: false, error: "Leave request is no longer pending" };

  const scopeWhere = await facultyScopeWhere(authResult.tenantId, authResult.userId);
  const canSee =
    "schoolId" in scopeWhere
      ? leave.faculty.schoolId === scopeWhere.schoolId
      : "departmentId" in scopeWhere
        ? leave.faculty.departmentId === scopeWhere.departmentId
        : true;
  if (!canSee) return { ok: false, error: "You cannot approve this leave request" };

  await prisma.facultyLeave.update({
    where: { id: leaveId },
    data: {
      status: approved ? "APPROVED" : "REJECTED",
      approvedBy: authResult.userId,
      notes: notes ?? leave.notes,
    },
  });

  const clerkUserId = leave.faculty.user.clerkUserId;
  const leaveTypeLabel = leave.leaveType.replace(/_/g, " ");
  const statusLabel = approved ? "approved" : "rejected";
  await sendNotification(authResult.tenantId, {
    user_id: clerkUserId,
    template_name: "leave_decision",
    variables: {
      leave_type: leaveTypeLabel,
      start_date: leave.startDate.toISOString().slice(0, 10),
      end_date: leave.endDate.toISOString().slice(0, 10),
      status: statusLabel,
      notes: notes ?? "",
    },
    channels: ["in_app"],
    fallback_title: `Leave request ${statusLabel}`,
    fallback_body: `Your ${leaveTypeLabel} leave (${leave.startDate.toISOString().slice(0, 10)} – ${leave.endDate.toISOString().slice(0, 10)}) has been ${statusLabel}.${notes ? ` Notes: ${notes}` : ""}`,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Filter options for HR pages (terms, schools, departments, programme modules)
// ---------------------------------------------------------------------------

export async function getHRFilterOptions(): Promise<
  | {
      ok: true;
      terms: { id: string; name: string }[];
      schools: { id: string; name: string }[];
      departments: { id: string; name: string }[];
      modules: { id: string; title: string; programmeId: string }[];
    }
  | { ok: false; error: string }
> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };

  const [terms, schools, departments, modules] = await Promise.all([
    prisma.academicTerm.findMany({
      where: { tenantId: authResult.tenantId },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    prisma.school.findMany({
      where: { tenantId: authResult.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { tenantId: authResult.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.programmeModule.findMany({
      where: { programme: { department: { tenantId: authResult.tenantId } } },
      select: { id: true, title: true, programmeId: true },
      orderBy: { title: "asc" },
      take: 500,
    }),
  ]);

  return {
    ok: true,
    terms: terms.map((t) => ({ id: t.id, name: t.name })),
    schools: schools.map((s) => ({ id: s.id, name: s.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    modules: modules.map((m) => ({ id: m.id, title: m.title, programmeId: m.programmeId })),
  };
}
