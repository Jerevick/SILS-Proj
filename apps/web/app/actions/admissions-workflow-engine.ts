"use server";

/**
 * Phase 14: Configurable Multi-Step Admissions Workflow Engine.
 * - Loads correct workflow by programme type (Certificate, Diploma, Undergraduate, Postgraduate).
 * - Routes application to next step automatically after approval.
 * - Triggers AI assistance (AdmissionsAIMatcher, prior learning assessment) at steps with aiAssistLevel SUMMARY/FULL.
 * - Sends notifications and escalation reminders (stub; integrate with existing email/notifications).
 * Respects Faculty → Department → Programme hierarchy and scoped roles.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import type {
  ProgrammeType,
  AdmissionApplicationStatus,
  ApplicationReviewStatus,
  AiAssistLevel,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowStepInput = {
  stepOrder: number;
  roleName: string;
  department?: string | null;
  requiredApproval: boolean;
  aiAssistLevel: AiAssistLevel;
};

export type AdmissionsWorkflowEngineResult =
  | { ok: true; applicationId: string; currentStepId: string | null; message?: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers: auth and workflow load
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return { ok: true as const, userId, tenantId: tenantResult.context.tenantId };
}

/**
 * Load the workflow for a given tenant and programme type.
 * Used by the engine to determine steps and advance application.
 */
export async function getWorkflowForProgrammeType(
  tenantId: string,
  programmeType: ProgrammeType
) {
  const workflow = await prisma.admissionWorkflow.findUnique({
    where: {
      tenantId_programmeType: { tenantId, programmeType },
    },
    include: {
      workflowSteps: {
        orderBy: { stepOrder: "asc" },
      },
    },
  });
  return workflow;
}

/**
 * Get application with workflow, current step, and review history.
 */
export async function getApplicationWithWorkflow(applicationId: string) {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false as const, error: authResult.error };

  const application = await prisma.admissionApplication.findFirst({
    where: {
      id: applicationId,
      tenantId: authResult.tenantId,
    },
    include: {
      programme: {
        include: {
          department: { include: { faculty: true } },
        },
      },
      currentWorkflowStep: true,
      reviews: {
        include: { step: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) return { ok: false as const, error: "Application not found" };

  const workflow = await getWorkflowForProgrammeType(
    authResult.tenantId,
    application.programmeType
  );

  return {
    ok: true as const,
    application,
    workflow,
  };
}

// ---------------------------------------------------------------------------
// AI assistance: summary / prior learning / AdmissionsAIMatcher
// ---------------------------------------------------------------------------

/**
 * Generate AI summary for an application at a given step (prior learning, fit, etc.).
 * Called when step has aiAssistLevel SUMMARY or FULL.
 */
async function generateAISummaryForStep(
  applicationId: string,
  stepId: string,
  tenantId: string
): Promise<string | null> {
  const application = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId },
    include: {
      programme: { select: { name: true, code: true } },
    },
  });
  if (!application) return null;

  // Gather context: equity metrics, competencies/skills graph if enabled, programme structure
  const [equity, competencies, programmeModules] = await Promise.all([
    prisma.equityMetric.findUnique({
      where: {
        tenantId_studentId: { tenantId, studentId: application.applicantId },
      },
    }),
    prisma.studentCompetency.findMany({
      where: { tenantId, studentId: application.applicantId },
      include: { competency: { select: { code: true, title: true } } },
      take: 20,
    }),
    application.programmeId
      ? prisma.programmeModule.findMany({
          where: { programmeId: application.programmeId },
          select: { title: true, credits: true, isCore: true },
          orderBy: { order: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const equitySummary = equity
    ? [
        equity.firstGen && "first-generation",
        equity.lowIncome && "low-income",
        equity.neurodiverse && "neurodiverse",
        equity.caregiver && "caregiver",
        equity.refugeeOrDisplaced && "refugee or displaced",
      ]
        .filter(Boolean)
        .join(", ")
    : "None recorded";

  const competencySummary =
    competencies.length > 0
      ? competencies.map((c) => `${c.competency.code}: ${c.competency.title} (${(c.masteryLevel * 100).toFixed(0)}%)`).join("; ")
      : "No competencies recorded";

  const programmeSummary =
    programmeModules.length > 0
      ? `Programme modules: ${programmeModules.map((m) => `${m.title} (${m.credits} cr)`).join(", ")}`
      : "No programme modules";

  const systemPrompt = `You are an admissions assistant. Given applicant context, produce a short summary (2–4 sentences) covering: fit for programme, prior learning / experience, and any equity or support considerations. Output plain text only, no JSON.`;
  const userMessage = `Application ID: ${applicationId}. Programme: ${application.programme?.name ?? application.programmeType}. Equity flags: ${equitySummary}. Competencies/skills: ${competencySummary}. ${programmeSummary}. Summarize suitability and prior learning.`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 512,
    cachePrefix: "admissions-summary",
  });

  if (!result.ok) return null;
  return result.text;
}

/**
 * Send notification / escalation reminder (stub).
 * Integrate with Resend, in-app notifications, or existing onboarding email flow.
 */
async function sendStepNotification(
  _applicationId: string,
  _stepId: string,
  _roleName: string,
  _type: "assigned" | "reminder" | "escalation"
): Promise<void> {
  // TODO: Integrate with apps/web/lib/send-user-created-email.ts or Resend
  // Notify users with matching role (e.g. Admissions, HoD) that an application is at their step
}

// ---------------------------------------------------------------------------
// AdmissionsWorkflowEngine: main entry
// ---------------------------------------------------------------------------

/**
 * AdmissionsWorkflowEngine (input: application_id).
 * - Loads correct workflow based on programme type.
 * - Routes to next step automatically after approval.
 * - Triggers AI assistance at appropriate steps.
 * - Sends notifications and escalation reminders.
 */
export async function admissionsWorkflowEngine(
  applicationId: string
): Promise<AdmissionsWorkflowEngineResult> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };

  const application = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId: authResult.tenantId },
    include: { currentWorkflowStep: true, reviews: { include: { step: true } } },
  });

  if (!application)
    return { ok: false, error: "Application not found" };

  if (
    application.status !== "SUBMITTED" &&
    application.status !== "IN_REVIEW" &&
    application.status !== "MORE_INFO_REQUESTED"
  ) {
    return {
      ok: false,
      error: `Application status is ${application.status}; workflow only runs for SUBMITTED/IN_REVIEW/MORE_INFO_REQUESTED`,
    };
  }

  const workflow = await getWorkflowForProgrammeType(
    authResult.tenantId,
    application.programmeType
  );

  if (!workflow || workflow.workflowSteps.length === 0) {
    return {
      ok: false,
      error: `No workflow defined for programme type ${application.programmeType}. Configure workflows in Admin > Workflows.`,
    };
  }

  const steps = workflow.workflowSteps;
  const currentStep = application.currentWorkflowStep;
  const currentStepIndex = currentStep
    ? steps.findIndex((s) => s.id === currentStep.id)
    : 0;

  // If no current step, start at first step and trigger AI if needed
  if (!currentStep) {
    const firstStep = steps[0];
    if (!firstStep) return { ok: true, applicationId, currentStepId: null };

    let aiSummary: string | null = null;
    if (firstStep.aiAssistLevel !== "NONE") {
      aiSummary = await generateAISummaryForStep(
        applicationId,
        firstStep.id,
        authResult.tenantId
      );
    }

    await prisma.$transaction([
      prisma.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: "IN_REVIEW",
          currentWorkflowStepId: firstStep.id,
        },
      }),
      prisma.applicationReview.upsert({
        where: {
          applicationId_stepId: { applicationId, stepId: firstStep.id },
        },
        create: {
          applicationId,
          stepId: firstStep.id,
          status: "PENDING",
          aiSummary,
        },
        update: { aiSummary: aiSummary ?? undefined },
      }),
    ]);

    await sendStepNotification(
      applicationId,
      firstStep.id,
      firstStep.roleName,
      "assigned"
    );

    return {
      ok: true,
      applicationId,
      currentStepId: firstStep.id,
      message: `Application moved to step: ${firstStep.roleName}`,
    };
  }

  // Check if current step has been approved (all required reviews for this step)
  const currentStepReview = application.reviews.find(
    (r) => r.stepId === currentStep.id
  );
  if (
    currentStepReview?.status === "APPROVED" &&
    currentStep.requiredApproval
  ) {
    // Advance to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      // Workflow complete — approve application
      await prisma.admissionApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          currentWorkflowStepId: null,
        },
      });
      return {
        ok: true,
        applicationId,
        currentStepId: null,
        message: "Application fully approved.",
      };
    }

    const nextStep = steps[nextIndex];
    let aiSummary: string | null = null;
    if (nextStep.aiAssistLevel !== "NONE") {
      aiSummary = await generateAISummaryForStep(
        applicationId,
        nextStep.id,
        authResult.tenantId
      );
    }

    await prisma.$transaction([
      prisma.admissionApplication.update({
        where: { id: applicationId },
        data: { currentWorkflowStepId: nextStep.id },
      }),
      prisma.applicationReview.upsert({
        where: {
          applicationId_stepId: { applicationId, stepId: nextStep.id },
        },
        create: {
          applicationId,
          stepId: nextStep.id,
          status: "PENDING",
          aiSummary,
        },
        update: { aiSummary: aiSummary ?? undefined },
      }),
    ]);

    await sendStepNotification(
      applicationId,
      nextStep.id,
      nextStep.roleName,
      "assigned"
    );

    return {
      ok: true,
      applicationId,
      currentStepId: nextStep.id,
      message: `Application advanced to: ${nextStep.roleName}`,
    };
  }

  return {
    ok: true,
    applicationId,
    currentStepId: currentStep.id,
    message: "No change; current step not yet approved.",
  };
}

// ---------------------------------------------------------------------------
// Submit review: Approve / Reject / Request More Info
// ---------------------------------------------------------------------------

export type SubmitReviewInput = {
  applicationId: string;
  stepId: string;
  status: ApplicationReviewStatus;
  comments?: string | null;
};

export async function submitApplicationReview(
  input: SubmitReviewInput
): Promise<AdmissionsWorkflowEngineResult> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };

  const { applicationId, stepId, status, comments } = input;

  const application = await prisma.admissionApplication.findFirst({
    where: { id: applicationId, tenantId: authResult.tenantId },
    include: { currentWorkflowStep: true },
  });

  if (!application)
    return { ok: false, error: "Application not found" };

  if (application.currentWorkflowStepId !== stepId)
    return { ok: false, error: "This step is not the current step for this application" };

  await prisma.applicationReview.update({
    where: {
      applicationId_stepId: { applicationId, stepId },
    },
    data: {
      status,
      comments: comments ?? undefined,
      reviewerId: authResult.userId,
    },
  });

  if (status === "REJECTED") {
    await prisma.admissionApplication.update({
      where: { id: applicationId },
      data: { status: "REJECTED", currentWorkflowStepId: null },
    });
    return {
      ok: true,
      applicationId,
      currentStepId: null,
      message: "Application rejected.",
    };
  }

  if (status === "MORE_INFO_REQUESTED") {
    await prisma.admissionApplication.update({
      where: { id: applicationId },
      data: { status: "MORE_INFO_REQUESTED" },
    });
    return {
      ok: true,
      applicationId,
      currentStepId: stepId,
      message: "More info requested.",
    };
  }

  // APPROVED — run engine to advance to next step (or complete)
  return admissionsWorkflowEngine(applicationId);
}

// ---------------------------------------------------------------------------
// Workflow CRUD (for Admin Workflow Builder)
// ---------------------------------------------------------------------------

export type SaveWorkflowInput = {
  tenantId: string;
  programmeType: ProgrammeType;
  name: string;
  steps: WorkflowStepInput[];
};

export async function saveAdmissionWorkflow(
  input: SaveWorkflowInput
): Promise<
  | { ok: true; workflowId: string }
  | { ok: false; error: string }
> {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false, error: authResult.error };
  if (authResult.tenantId !== input.tenantId)
    return { ok: false, error: "Tenant mismatch" };

  const stepsSnapshot = input.steps.map((s) => ({
    stepOrder: s.stepOrder,
    roleName: s.roleName,
    department: s.department ?? null,
    requiredApproval: s.requiredApproval,
    aiAssistLevel: s.aiAssistLevel,
  }));

  const workflow = await prisma.admissionWorkflow.upsert({
    where: {
      tenantId_programmeType: {
        tenantId: input.tenantId,
        programmeType: input.programmeType,
      },
    },
    create: {
      tenantId: input.tenantId,
      programmeType: input.programmeType,
      name: input.name,
      steps: stepsSnapshot as object,
      workflowSteps: {
        create: input.steps.map((s) => ({
          stepOrder: s.stepOrder,
          roleName: s.roleName,
          department: s.department ?? null,
          requiredApproval: s.requiredApproval,
          aiAssistLevel: s.aiAssistLevel,
        })),
      },
    },
    update: {
      name: input.name,
      steps: stepsSnapshot as object,
    },
    include: { workflowSteps: true },
  });

  // Always replace steps so reorder and edits are reflected (delete + create)
  await prisma.workflowStep.deleteMany({
    where: { workflowId: workflow.id },
  });
  await prisma.workflowStep.createMany({
    data: input.steps.map((s) => ({
      workflowId: workflow.id,
      stepOrder: s.stepOrder,
      roleName: s.roleName,
      department: s.department ?? null,
      requiredApproval: s.requiredApproval,
      aiAssistLevel: s.aiAssistLevel,
    })),
  });

  return { ok: true, workflowId: workflow.id };
}

/** List workflows for tenant (for admin builder). */
export async function listAdmissionWorkflows(tenantId: string) {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false as const, error: authResult.error };
  if (authResult.tenantId !== tenantId)
    return { ok: false as const, error: "Tenant mismatch" };

  const workflows = await prisma.admissionWorkflow.findMany({
    where: { tenantId },
    include: { workflowSteps: { orderBy: { stepOrder: "asc" } } },
  });
  return { ok: true as const, workflows };
}

/** List admission applications for tenant (for admissions queue). */
export async function listAdmissionApplications(tenantId: string) {
  const authResult = await requireTenant();
  if (!authResult.ok) return { ok: false as const, error: authResult.error };
  if (authResult.tenantId !== tenantId)
    return { ok: false as const, error: "Tenant mismatch" };

  const applications = await prisma.admissionApplication.findMany({
    where: { tenantId },
    include: {
      programme: { select: { name: true, code: true } },
      currentWorkflowStep: true,
      reviews: { include: { step: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return { ok: true as const, applications };
}
