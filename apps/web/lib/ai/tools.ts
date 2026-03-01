/**
 * AI Orchestrator — tool definitions for function calling.
 * Anthropic tool-use format + OpenAI compatibility. All tools are tenant-scoped.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { InterventionBriefType } from "@prisma/client";

/** Vector string for PGVector (1536-dim). */
function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/** Anthropic-style tool definition (name, description, input_schema). */
export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
  };
};

export const ORCHESTRATOR_TOOLS: ToolDef[] = [
  {
    name: "getStudentMastery",
    description: "Get mastery state for a student (and optional module). Uses StudentMasteryState and StudentModuleProgress.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string", description: "Tenant ID" },
        studentId: { type: "string", description: "Clerk user ID of student" },
        moduleId: { type: "string", description: "Optional module ID to scope" },
      },
      required: ["tenantId", "studentId"],
    },
  },
  {
    name: "searchSkills",
    description: "Semantic search over SkillNodes by vector embedding (1536-dim). Returns top-k skills with similarity.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        embedding: { type: "array", description: "1536-dim embedding array" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["tenantId", "embedding"],
    },
  },
  {
    name: "createIntervention",
    description: "Create an InterventionBrief for a student (MICRO_SCAFFOLD, LECTURER_INTERVENTION, etc.).",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        studentId: { type: "string" },
        moduleId: { type: "string" },
        courseId: { type: "string" },
        briefType: { type: "string", description: "MICRO_SCAFFOLD | ALTERNATIVE_EXPLANATION | BRANCHING_PATHWAY | LECTURER_INTERVENTION" },
        content: { type: "string", description: "Brief content (markdown or text)" },
      },
      required: ["tenantId", "studentId", "briefType", "content"],
    },
  },
  {
    name: "listFrictionSignals",
    description: "List recent FrictionSignals for tenant, optionally by studentId, with optional since date.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        studentId: { type: "string" },
        since: { type: "string", description: "ISO date string (e.g. last 7 days)" },
        limit: { type: "number" },
      },
      required: ["tenantId"],
    },
  },
  {
    name: "getInterventionBriefs",
    description: "List InterventionBriefs for tenant, optionally by studentId and status.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        studentId: { type: "string" },
        status: { type: "string", description: "PENDING | SENT | ACKNOWLEDGED" },
        limit: { type: "number" },
      },
      required: ["tenantId"],
    },
  },
  {
    name: "listModules",
    description: "List modules for a course or tenant.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        courseId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["tenantId"],
    },
  },
  {
    name: "getSubmission",
    description: "Get a submission by ID (includes assignment, rubric, content).",
    input_schema: {
      type: "object",
      properties: {
        submissionId: { type: "string" },
      },
      required: ["submissionId"],
    },
  },
  {
    name: "updateSubmissionGrade",
    description: "Update submission with AI grade, feedback, and confidence score.",
    input_schema: {
      type: "object",
      properties: {
        submissionId: { type: "string" },
        aiGrade: { type: "object", description: "JSON: per-criterion and overall" },
        aiFeedback: { type: "string" },
        confidenceScore: { type: "number", description: "0-1" },
      },
      required: ["submissionId", "aiGrade", "aiFeedback", "confidenceScore"],
    },
  },
  {
    name: "listSystemInsights",
    description: "List recent SystemInsights for the tenant (proactive insights).",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["tenantId"],
    },
  },
  {
    name: "listCourses",
    description: "List courses for the tenant.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string" },
        limit: { type: "number" },
      },
      required: ["tenantId"],
    },
  },
];

type ToolName = (typeof ORCHESTRATOR_TOOLS)[number]["name"];

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Execute a single tool call. All queries are tenant-scoped where applicable. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  tenantId: string
): Promise<ToolResult> {
  try {
    switch (name as ToolName) {
      case "getStudentMastery": {
        const studentId = args.studentId as string;
        const moduleId = args.moduleId as string | undefined;
        const [state, progress] = await Promise.all([
          prisma.studentMasteryState.findMany({
            where: { tenantId, studentId, ...(moduleId ? { moduleId } : {}) },
            take: 10,
          }),
          prisma.studentModuleProgress.findMany({
            where: { tenantId, studentId, ...(moduleId ? { moduleId } : {}) },
            take: 10,
            select: { moduleId, masteryScore, currentPathwayStep, frictionHistory: true },
          }),
        ]);
        return { ok: true, data: { state, progress } };
      }

      case "searchSkills": {
        const embedding = args.embedding as number[];
        const limit = Math.min(20, Math.max(1, (args.limit as number) ?? 10));
        if (!Array.isArray(embedding) || embedding.length !== 1536) {
          return { ok: false, error: "embedding must be 1536-dim number array" };
        }
        const vectorStr = toVectorString(embedding);
        const rows = await prisma.$queryRaw<
          Array<{ id: string; name: string; description: string | null; similarity: string }>
        >(Prisma.sql`
          SELECT id, name, description,
                 1 - (embedding <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)) AS similarity
          FROM "SkillNode"
          WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL
          ORDER BY embedding <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)
          LIMIT ${limit}
        `);
        return {
          ok: true,
          data: rows.map((r) => ({ ...r, similarity: Number(r.similarity) })),
        };
      }

      case "createIntervention": {
        const studentId = args.studentId as string;
        const briefType = args.briefType as InterventionBriefType;
        const content = args.content as string;
        const moduleId = (args.moduleId as string) || null;
        const courseId = (args.courseId as string) || null;
        const brief = await prisma.interventionBrief.create({
          data: {
            tenantId,
            studentId,
            moduleId,
            courseId,
            briefType,
            content,
            status: "PENDING",
          },
        });
        return { ok: true, data: brief };
      }

      case "listFrictionSignals": {
        const studentId = args.studentId as string | undefined;
        const since = args.since as string | undefined;
        const limit = Math.min(100, (args.limit as number) ?? 20);
        const where: Prisma.FrictionSignalWhereInput = { tenantId };
        if (studentId) where.studentId = studentId;
        if (since) where.createdAt = { gte: new Date(since) };
        const list = await prisma.frictionSignal.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return { ok: true, data: list };
      }

      case "getInterventionBriefs": {
        const studentId = args.studentId as string | undefined;
        const status = args.status as "PENDING" | "SENT" | "ACKNOWLEDGED" | undefined;
        const limit = Math.min(50, (args.limit as number) ?? 20);
        const where: Prisma.InterventionBriefWhereInput = { tenantId };
        if (studentId) where.studentId = studentId;
        if (status) where.status = status;
        const list = await prisma.interventionBrief.findMany({
          where,
          orderBy: { createdByAgentAt: "desc" },
          take: limit,
        });
        return { ok: true, data: list };
      }

      case "listModules": {
        const courseId = args.courseId as string | undefined;
        const limit = Math.min(100, (args.limit as number) ?? 50);
        if (courseId) {
          const list = await prisma.module.findMany({
            where: { courseId, course: { tenantId } },
            orderBy: { order: "asc" },
            take: limit,
          });
          return { ok: true, data: list };
        }
        const list = await prisma.module.findMany({
          where: { course: { tenantId } },
          orderBy: { order: "asc" },
          take: limit,
          include: { course: { select: { id: true, title: true } } },
        });
        return { ok: true, data: list };
      }

      case "getSubmission": {
        const submissionId = args.submissionId as string;
        const sub = await prisma.submission.findUnique({
          where: { id: submissionId },
          include: {
            assignment: { include: { module: true, rubric: true } },
          },
        });
        if (!sub) return { ok: false, error: "Submission not found" };
        return { ok: true, data: sub };
      }

      case "updateSubmissionGrade": {
        const submissionId = args.submissionId as string;
        const aiGrade = args.aiGrade as object;
        const aiFeedback = args.aiFeedback as string;
        const confidenceScore = args.confidenceScore as number;
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            aiGrade: aiGrade as Prisma.InputJsonValue,
            aiFeedback,
            confidenceScore: Math.max(0, Math.min(1, confidenceScore)),
          },
        });
        return { ok: true, data: { submissionId, updated: true } };
      }

      case "listSystemInsights": {
        const limit = Math.min(50, (args.limit as number) ?? 20);
        const list = await prisma.systemInsight.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return { ok: true, data: list };
      }

      case "listCourses": {
        const limit = Math.min(100, (args.limit as number) ?? 50);
        const list = await prisma.course.findMany({
          where: { tenantId },
          take: limit,
          select: { id: true, title: true, slug: true },
        });
        return { ok: true, data: list };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Convert to Anthropic tools format (for messages API). */
export function toAnthropicTools(): Array<{ name: string; description: string; input_schema: ToolDef["input_schema"] }> {
  return ORCHESTRATOR_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/** Convert to OpenAI tools format (for chat.completions). */
export function toOpenAITools(): Array<{ type: "function"; function: { name: string; description: string; parameters: { type: "object"; properties: Record<string, unknown>; required: string[] } } }> {
  return ORCHESTRATOR_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: t.input_schema.properties as Record<string, unknown>,
        required: t.input_schema.required,
      },
    },
  }));
}
