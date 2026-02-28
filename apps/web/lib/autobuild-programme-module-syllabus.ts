/**
 * Lecturer Syllabus Auto-Build: parse syllabus with Claude and generate
 * detailed content outline, learning outcomes (aligned to programme), assignments + rubrics,
 * tests, and adaptive pathways. Store in ProgrammeModule.syllabusGeneratedJson and set
 * syllabusStatus to PENDING_REVIEW.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export type SyllabusAutoBuildInput = {
  moduleId: string;
  syllabusText: string;
  programmeLearningOutcomes?: string[]; // Optional programme-level outcomes to align to
};

export type SyllabusGeneratedContent = {
  contentOutline: { title: string; summary: string; order: number }[];
  learningOutcomes: { id: string; text: string; alignedToProgramme?: string }[];
  assignments: {
    title: string;
    type: string;
    description?: string;
    rubric?: { criteria: { name: string; points: number; description?: string }[] };
  }[];
  tests: { title: string; type: string; itemCount?: number }[];
  adaptivePathways?: { condition: string; path: string }[];
};

export type SyllabusAutoBuildResult =
  | { ok: true; moduleId: string; status: "PENDING_REVIEW" }
  | { ok: false; error: string };

export async function buildSyllabusForProgrammeModule(
  input: SyllabusAutoBuildInput
): Promise<SyllabusAutoBuildResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }

  const moduleRecord = await prisma.programmeModule.findUnique({
    where: { id: input.moduleId },
    include: { programme: true },
  });
  if (!moduleRecord) {
    return { ok: false, error: "Programme module not found." };
  }

  const anthropic = new Anthropic({ apiKey });

  const programmeOutcomesText =
    (input.programmeLearningOutcomes?.length
      ? "Programme learning outcomes to align to:\n" +
        input.programmeLearningOutcomes.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "No specific programme outcomes provided; align to general academic standards.") +
    "\n\nModule title: " +
    moduleRecord.title;

  const systemPrompt = `You are an expert instructional designer. Given a module syllabus (and optional programme outcomes), output a valid JSON object (no markdown, no code fence) with this exact structure:
{
  "contentOutline": [
    { "title": "Section title", "summary": "Brief summary", "order": 0 }
  ],
  "learningOutcomes": [
    { "id": "LO1", "text": "Outcome statement", "alignedToProgramme": "optional programme outcome ref" }
  ],
  "assignments": [
    {
      "title": "Assignment title",
      "type": "QUIZ|ESSAY|PROJECT|DISCUSSION|OTHER",
      "description": "Optional",
      "rubric": {
        "criteria": [
          { "name": "Criterion", "points": 10, "description": "Optional" }
        ]
      }
    }
  ],
  "tests": [
    { "title": "Test title", "type": "midterm|final|quiz", "itemCount": 10 }
  ],
  "adaptivePathways": [
    { "condition": "e.g. If student scores < 60% on quiz", "path": "e.g. Review unit 2 then retry" }
  ]
}
Rules: Create 4-12 content outline items. Create 3-8 learning outcomes. Create 2-5 assignments with rubrics where appropriate. Create 1-3 tests. adaptivePathways is optional. Use only the assignment types listed. Output only the JSON object, no other text.`;

  const userPrompt = `${programmeOutcomesText}\n\nSyllabus text:\n${input.syllabusText}`;

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
    console.error("Syllabus autobuild Anthropic error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "LLM request failed.",
    };
  }

  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: SyllabusGeneratedContent;
  try {
    parsed = JSON.parse(trimmed) as SyllabusGeneratedContent;
  } catch (e) {
    console.error("Parse syllabus autobuild output error:", e);
    return {
      ok: false,
      error: "Failed to parse generated content from AI response.",
    };
  }

  if (!parsed.contentOutline || !Array.isArray(parsed.learningOutcomes)) {
    return {
      ok: false,
      error: "Invalid structure: missing contentOutline or learningOutcomes.",
    };
  }

  try {
    await prisma.programmeModule.update({
      where: { id: input.moduleId },
      data: {
        syllabusText: input.syllabusText,
        syllabusGeneratedJson: parsed as unknown as object,
        syllabusStatus: "PENDING_REVIEW",
      },
    });
  } catch (e) {
    console.error("Update programme module syllabus error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save generated syllabus.",
    };
  }

  return {
    ok: true,
    moduleId: input.moduleId,
    status: "PENDING_REVIEW",
  };
}
