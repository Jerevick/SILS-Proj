/**
 * GET /api/admin/workflows?tenantId=xxx — List admission workflows for a tenant.
 * POST /api/admin/workflows — Create or update workflow (body: tenantId, programmeType, name, steps).
 * Platform admin only (can view institutions to list, can manage to save).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canViewInstitutions,
  canManageInstitutions,
} from "@/lib/platform-auth";
import type { ProgrammeType, AiAssistLevel } from "@prisma/client";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await canViewInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId query required" },
      { status: 400 }
    );
  }

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
  tenantId: string;
  programmeType: ProgrammeType;
  name: string;
  steps: StepPayload[];
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await canManageInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId, programmeType, name, steps } = body;
  if (!tenantId || !programmeType || !name || !Array.isArray(steps)) {
    return NextResponse.json(
      { error: "tenantId, programmeType, name, and steps required" },
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

    // Replace steps so reorder and edits are reflected
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
