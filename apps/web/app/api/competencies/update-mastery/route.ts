/**
 * POST /api/competencies/update-mastery — Called from LMS when a module is completed.
 * Updates StudentCompetency (mastery, evidence, vector embedding) for linked competencies.
 * Body: { tenantId, studentId, competencyId, masteryLevel, evidenceJson? }
 * Or: { tenantId, studentId, programmeModuleId, grade?, completedAt? } to derive competency from programme.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { getEmbeddingOrNull } from "@/lib/embeddings";
import { toVectorString } from "@/lib/competency-vector";
import { z } from "zod";

const bodySchemaDirect = z.object({
  tenantId: z.string(),
  studentId: z.string(),
  competencyId: z.string(),
  masteryLevel: z.number().min(0).max(1),
  evidenceJson: z.record(z.unknown()).optional(),
});

const bodySchemaFromModule = z.object({
  tenantId: z.string(),
  studentId: z.string(),
  programmeModuleId: z.string(),
  grade: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { role, tenantId: contextTenantId } = result.context;
  const canUpdate =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canUpdate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const direct = bodySchemaDirect.safeParse(body);
  if (direct.success) {
    const { tenantId, studentId, competencyId, masteryLevel, evidenceJson } = direct.data;
    if (tenantId !== contextTenantId) {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }
    try {
      const competency = await prisma.competency.findFirst({
        where: { id: competencyId },
      });
      if (!competency) {
        return NextResponse.json({ error: "Competency not found" }, { status: 404 });
      }
      await prisma.studentCompetency.upsert({
        where: {
          tenantId_studentId_competencyId: { tenantId, studentId, competencyId },
        },
        create: {
          tenantId,
          studentId,
          competencyId,
          masteryLevel,
          evidenceJson: evidenceJson ?? undefined,
        },
        update: {
          masteryLevel,
          evidenceJson: evidenceJson ?? undefined,
        },
      });
      const textForEmbedding = `${competency.title} ${competency.description ?? ""} ${competency.code}`.trim();
      const embedding = await getEmbeddingOrNull(textForEmbedding);
      if (embedding?.length) {
        const vectorStr = toVectorString(embedding);
        await prisma.$executeRawUnsafe(
          `UPDATE "StudentCompetency" SET "vectorEmbedding" = $1::vector, "lastUpdated" = NOW() WHERE "tenantId" = $2 AND "studentId" = $3 AND "competencyId" = $4`,
          vectorStr,
          tenantId,
          studentId,
          competencyId
        );
      }
      return NextResponse.json({ ok: true, competencyId, masteryLevel });
    } catch (e) {
      console.error("Update mastery (direct) error:", e);
      return NextResponse.json({ error: "Failed to update mastery." }, { status: 500 });
    }
  }

  const fromModule = bodySchemaFromModule.safeParse(body);
  if (fromModule.success) {
    const { tenantId, studentId, programmeModuleId } = fromModule.data;
    if (tenantId !== contextTenantId) {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }
    const programmeModule = await prisma.programmeModule.findFirst({
      where: { id: programmeModuleId, programme: { department: { tenantId } } },
      include: { programme: { include: { competencies: true } } },
    });
    if (!programmeModule) {
      return NextResponse.json({ error: "Programme module not found" }, { status: 404 });
    }
    const competencies = programmeModule.programme.competencies;
    if (competencies.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No competencies linked to programme; nothing to update.",
      });
    }
    const evidenceJson = {
      programmeModuleId,
      programmeModuleTitle: programmeModule.title,
      completedAt: fromModule.data.completedAt ?? new Date().toISOString(),
      grade: fromModule.data.grade,
    };
    const masteryLevel = 0.85;
    for (const comp of competencies) {
      await prisma.studentCompetency.upsert({
        where: {
          tenantId_studentId_competencyId: { tenantId, studentId, competencyId: comp.id },
        },
        create: {
          tenantId,
          studentId,
          competencyId: comp.id,
          masteryLevel,
          evidenceJson,
        },
        update: {
          masteryLevel,
          evidenceJson: evidenceJson as object,
        },
      });
      const textForEmbedding = `${comp.title} ${comp.description ?? ""} ${comp.code}`.trim();
      const embedding = await getEmbeddingOrNull(textForEmbedding);
      if (embedding?.length) {
        const vectorStr = toVectorString(embedding);
        await prisma.$executeRawUnsafe(
          `UPDATE "StudentCompetency" SET "vectorEmbedding" = $1::vector, "lastUpdated" = NOW() WHERE "tenantId" = $2 AND "studentId" = $3 AND "competencyId" = $4`,
          vectorStr,
          tenantId,
          studentId,
          comp.id
        );
      }
    }
    return NextResponse.json({ ok: true, updated: competencies.length });
  }

  return NextResponse.json(
    { error: "Body: use { tenantId, studentId, competencyId, masteryLevel } or { tenantId, studentId, programmeModuleId }" },
    { status: 400 }
  );
}
