/**
 * GET /api/workflows — List admission workflows for the current institution (tenant).
 * POST /api/workflows — Create or update workflow (body: programmeType, name, steps).
 * Uses auth org to resolve tenant. For institution (Admissions) users.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import type { ProgrammeType, AiAssistLevel } from "@prisma/client";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantId = result.context.tenantId;

  try {
    const workflows = await prisma.admissionWorkflow.findMany({
      where: { tenantId },
      include: {
        workflowSteps: { orderBy: { stepOrder: "asc" } },
      },
    });

    return NextResponse.json(workflows);
  } catch (e) {
    console.error("List workflows error:", e);
    return NextResponse.json(
      { error: "Failed to list workflows." },
      { status: 500 }
    );
  }
}

type StepPayload = {
  stepOrder: number;
  roleName: string;
  department?: string | null;
  requiredApproval: boolean;
  aiAssistLevel: AiAssistLevel;
};

type PostBody = {
  programmeType: ProgrammeType;
  name: string;
  steps: StepPayload[];
};

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantId = result.context.tenantId;

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { programmeType, name, steps } = body;
  if (!programmeType || !name || !Array.isArray(steps)) {
    return NextResponse.json(
      { error: "programmeType, name, and steps required" },
      { status: 400 }
    );
  }

  try {
    const stepsSnapshot = steps.map((s) => ({
      stepOrder: s.stepOrder,
      roleName: s.roleName,
      department: s.department ?? null,
      requiredApproval: s.requiredApproval,
      aiAssistLevel: s.aiAssistLevel,
    }));

    const workflow = await prisma.admissionWorkflow.upsert({
      where: {
        tenantId_programmeType: { tenantId, programmeType },
      },
      create: {
        tenantId,
        programmeType,
        name,
        steps: stepsSnapshot as object,
        workflowSteps: {
          create: steps.map((s) => ({
            stepOrder: s.stepOrder,
            roleName: s.roleName,
            department: s.department ?? null,
            requiredApproval: s.requiredApproval,
            aiAssistLevel: s.aiAssistLevel,
          })),
        },
      },
      update: {
        name,
        steps: stepsSnapshot as object,
      },
      include: { workflowSteps: true },
    });

    await prisma.workflowStep.deleteMany({
      where: { workflowId: workflow.id },
    });
    await prisma.workflowStep.createMany({
      data: steps.map((s) => ({
        workflowId: workflow.id,
        stepOrder: s.stepOrder,
        roleName: s.roleName,
        department: s.department ?? null,
        requiredApproval: s.requiredApproval,
        aiAssistLevel: s.aiAssistLevel,
      })),
    });

    return NextResponse.json({ ok: true, workflowId: workflow.id });
  } catch (e) {
    console.error("Save workflow error:", e);
    return NextResponse.json(
      { error: "Failed to save workflow." },
      { status: 500 }
    );
  }
}
