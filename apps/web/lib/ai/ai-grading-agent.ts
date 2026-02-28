/**
 * Phase 12: AIGradingAgent — uses LLM_Router (Claude Sonnet) to grade a submission
 * against rubric criteria. Returns per-criterion feedback, overall grade,
 * confidence score, and suggested comments. Stores AI results in submission record.
 */

import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import type {
  AIGradingAgentInput,
  AIGradingAgentOutput,
  AIGradingResult,
  RubricCriterion,
} from "@/lib/ai/ai-grading-types";

const SYSTEM_PROMPT = `You are an expert academic grader. Your task is to grade a student submission against a rubric.

You will receive:
1. The rubric criteria (each with id, name, description, maxPoints, optional weight).
2. The student's submission content (text and/or description of attachments).

Output a single JSON object (no markdown, no code fence) with this exact structure:
{
  "criteria": [
    {
      "criterionId": "string - must match the rubric criterion id",
      "points": number,
      "maxPoints": number,
      "feedback": "string - brief constructive feedback for this criterion"
    }
  ],
  "overallGrade": "string - e.g. '85', 'A', '42/50' (numeric or letter as appropriate)",
  "overallFeedback": "string - 2-4 sentences summarizing strengths and areas for improvement",
  "confidenceScore": number between 0 and 1 (how confident you are in this grading; 1 = very clear submission and criteria),
  "suggestedComments": ["string - optional array of 1-3 ready-to-paste comment snippets for the lecturer"]
}

Rules:
- Be fair and consistent. Align points with the rubric's maxPoints per criterion.
- If the submission is empty or irrelevant, give 0 points and explain in feedback.
- overallGrade should reflect the same scale as the rubric (e.g. if all criteria are points, use points or percentage).
- Output only the JSON object.`;

function parseCriteria(criteria: unknown): RubricCriterion[] {
  if (!Array.isArray(criteria)) return [];
  return criteria
    .filter(
      (c): c is Record<string, unknown> =>
        c != null && typeof c === "object" && typeof (c as Record<string, unknown>).id === "string"
    )
    .map((c) => ({
      id: String(c.id),
      name: typeof c.name === "string" ? c.name : "Criterion",
      description: typeof c.description === "string" ? c.description : undefined,
      maxPoints: typeof c.maxPoints === "number" ? c.maxPoints : 10,
      weight: typeof c.weight === "number" ? c.weight : undefined,
    }));
}

function parseGradingResult(raw: string): AIGradingResult | null {
  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const criteria = Array.isArray(parsed.criteria)
      ? (parsed.criteria as Record<string, unknown>[]).map((c) => ({
          criterionId: String(c.criterionId ?? c.id ?? ""),
          points: typeof c.points === "number" ? c.points : 0,
          maxPoints: typeof c.maxPoints === "number" ? c.maxPoints : 10,
          feedback: typeof c.feedback === "string" ? c.feedback : "",
        }))
      : [];
    const overallGrade = typeof parsed.overallGrade === "string" ? parsed.overallGrade : "0";
    const overallFeedback =
      typeof parsed.overallFeedback === "string" ? parsed.overallFeedback : "";
    const confidenceScore =
      typeof parsed.confidenceScore === "number"
        ? Math.max(0, Math.min(1, parsed.confidenceScore))
        : 0.5;
    const suggestedComments = Array.isArray(parsed.suggestedComments)
      ? (parsed.suggestedComments as string[]).filter((s) => typeof s === "string")
      : [];
    return {
      criteria,
      overallGrade,
      overallFeedback,
      confidenceScore,
      suggestedComments,
    };
  } catch {
    return null;
  }
}

export async function runAIGradingAgent(
  input: AIGradingAgentInput
): Promise<AIGradingAgentOutput> {
  const [submission, rubric] = await Promise.all([
    prisma.submission.findFirst({
      where: { id: input.submissionId },
      include: {
        assignment: {
          include: {
            module: { include: { course: true } },
          },
        },
      },
    }),
    prisma.rubric.findFirst({
      where: { id: input.rubricId },
      include: { module: true },
    }),
  ]);

  if (!submission) {
    return { ok: false, error: "Submission not found." };
  }
  if (!rubric) {
    return { ok: false, error: "Rubric not found." };
  }
  const course = submission.assignment.module.course;
  if (!course || course.tenantId !== input.tenantId) {
    return { ok: false, error: "Submission not in tenant." };
  }
  if (rubric.moduleId !== submission.assignment.moduleId) {
    return { ok: false, error: "Rubric does not belong to the submission's module." };
  }

  const criteria = parseCriteria(rubric.criteria as unknown);
  if (criteria.length === 0) {
    return { ok: false, error: "Rubric has no criteria." };
  }

  const submissionContent =
    submission.content?.trim() || "No text content provided.";
  const attachments = submission.attachmentsJson as
    | { type?: string; url?: string; name?: string }[]
    | null;
  const attachmentSummary =
    attachments && Array.isArray(attachments)
      ? attachments
          .map(
            (a) =>
              `[${a.type ?? "file"}] ${a.name ?? a.url ?? "attachment"}`
          )
          .join(", ")
      : "No attachments.";

  const userPrompt = [
    "Rubric:",
    JSON.stringify(
      criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxPoints: c.maxPoints,
        weight: c.weight,
      })),
      null,
      2
    ),
    "",
    "Submission content:",
    submissionContent,
    "",
    "Attachments:",
    attachmentSummary,
  ].join("\n");

  const routerResult = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 2048,
    cachePrefix: "ai-grading",
  });

  if (!routerResult.ok) {
    return { ok: false, error: routerResult.error };
  }

  const result = parseGradingResult(routerResult.text);
  if (!result) {
    return { ok: false, error: "Failed to parse AI grading response." };
  }

  // Store AI results in submission (human can override later)
  await prisma.submission.update({
    where: { id: input.submissionId },
    data: {
      aiGrade: result as unknown as object,
      aiFeedback: result.overallFeedback,
      confidenceScore: result.confidenceScore,
      humanOverride: false,
      // Pre-fill grade/feedback for display; lecturer can change before finalize
      grade: result.overallGrade,
      feedback: result.overallFeedback,
    },
  });

  return { ok: true, result };
}
