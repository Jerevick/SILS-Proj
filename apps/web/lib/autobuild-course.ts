/**
 * AutoBuild course: use Claude to generate course structure from syllabus + learning outcomes,
 * then persist to Prisma. Used by server action and optionally by API route.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import type { AssignmentType, CourseMode } from "@prisma/client";

const ASSIGNMENT_TYPES: AssignmentType[] = [
  "QUIZ",
  "ESSAY",
  "PROJECT",
  "DISCUSSION",
  "OTHER",
];

export type AutobuildInput = {
  syllabus: string;
  learningOutcomes: string;
};

export type AutobuildResult =
  | { ok: true; courseId: string; title: string; slug: string }
  | { ok: false; error: string };

/** JSON shape we ask the LLM to produce */
type LLMCourseStructure = {
  title: string;
  description?: string;
  mode?: "SYNC" | "ASYNC";
  modules: {
    title: string;
    order: number;
    contentType?: string;
    contentSummary?: string;
    assignments?: {
      title: string;
      type: string;
      dueRelativeWeeks?: number;
      rubric?: { criteria: { name: string; points: number; description?: string }[] };
    }[];
  }[];
};

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseAssignmentType(s: string): AssignmentType {
  const u = s?.toUpperCase();
  if (ASSIGNMENT_TYPES.includes(u as AssignmentType)) return u as AssignmentType;
  return "OTHER";
}

export async function buildCourseFromSyllabus(
  tenantId: string,
  createdBy: string,
  input: AutobuildInput
): Promise<AutobuildResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are an expert instructional designer. Given a course syllabus and learning outcomes, output a valid JSON object (no markdown, no code fence) with this exact structure:
{
  "title": "Course title (string)",
  "description": "Brief course description (string, optional)",
  "mode": "SYNC or ASYNC (optional, default ASYNC)",
  "modules": [
    {
      "title": "Module title",
      "order": 0,
      "contentType": "text|video|embed|file (optional)",
      "contentSummary": "Short summary of module content (optional)",
      "assignments": [
        {
          "title": "Assignment title",
          "type": "QUIZ|ESSAY|PROJECT|DISCUSSION|OTHER",
          "dueRelativeWeeks": 1,
          "rubric": {
            "criteria": [
              { "name": "Criterion name", "points": 10, "description": "Optional" }
            ]
          }
        }
      ]
    }
  ]
}
Rules: Create 4-10 modules. Each module may have 0-3 assignments. order must be 0, 1, 2, ... Use only the assignment types listed. Output only the JSON object, no other text.`;

  const userPrompt = `Syllabus:\n${input.syllabus}\n\nLearning outcomes:\n${input.learningOutcomes}`;

  let raw: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = message.content.find((b) => b.type === "text");
    raw = block && "text" in block ? block.text : "";
  } catch (e) {
    console.error("Anthropic API error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "LLM request failed.",
    };
  }

  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: LLMCourseStructure;
  try {
    parsed = JSON.parse(trimmed) as LLMCourseStructure;
  } catch (e) {
    console.error("Parse LLM output error:", e);
    return { ok: false, error: "Failed to parse course structure from AI response." };
  }

  if (!parsed.title || !Array.isArray(parsed.modules)) {
    return { ok: false, error: "Invalid course structure: missing title or modules." };
  }

  const slugBase = toSlug(parsed.title);
  let slug = slugBase;
  let suffix = 0;
  while (true) {
    const existing = await prisma.course.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (!existing) break;
    suffix += 1;
    slug = `${slugBase}-${suffix}`;
  }

  const courseMode: CourseMode = parsed.mode === "SYNC" ? "SYNC" : "ASYNC";

  try {
    const course = await prisma.course.create({
      data: {
        tenantId,
        title: parsed.title,
        slug,
        description: parsed.description ?? null,
        createdBy,
        mode: courseMode,
        modules: {
          create: (parsed.modules ?? []).map((m, idx) => ({
            title: m.title ?? `Module ${idx + 1}`,
            order: typeof m.order === "number" ? m.order : idx,
            contentType: m.contentType ?? "text",
            contentJson: m.contentSummary
              ? { summary: m.contentSummary }
              : undefined,
            assignments: {
              create: (m.assignments ?? []).map((a, aIdx) => ({
                title: a.title ?? `Assignment ${aIdx + 1}`,
                type: parseAssignmentType(a.type),
                dueDate: undefined,
                rubricJson: a.rubric ?? undefined,
              })),
            },
          })),
        },
      },
    });

    return {
      ok: true,
      courseId: course.id,
      title: course.title,
      slug: course.slug,
    };
  } catch (e) {
    console.error("Create course from autobuild error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save course.",
    };
  }
}
