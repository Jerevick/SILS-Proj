/**
 * POST /api/whiteboard/[id]/suggest — AI suggestion for whiteboard ("clean this diagram", "add explanation").
 * Returns suggested text or structured edit; client can apply to tldraw document.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { z } from "zod";

const postBodySchema = z.object({
  request: z.string().min(1).max(500),
  /** Optional: serialized snapshot or description of current shapes for context */
  context: z.string().max(4000).optional(),
});

const SYSTEM_PROMPT = `You are an AI assistant for a collaborative whiteboard (e.g. tldraw). The user can ask you to "clean this diagram", "add explanation", "simplify", etc.

Respond with a single JSON object (no markdown, no code fence):
{
  "suggestion": "string - clear, actionable suggestion text the user can apply (e.g. 'Add a short label under the main box: Summary of steps')",
  "type": "label" | "restructure" | "explain" | "simplify" | "other"
}

Keep the suggestion concise and implementable by a human on the board.`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const id = (await params).id;
  const board = await prisma.whiteboardSession.findFirst({
    where: { id, tenantId: result.context.tenantId },
  });

  if (!board) {
    return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userPrompt = parsed.data.context
    ? `Current board context: ${parsed.data.context}\n\nUser request: ${parsed.data.request}`
    : `User request: ${parsed.data.request}`;

  const llmResult = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 512,
    cachePrefix: undefined,
  });

  if (!llmResult.ok) {
    return NextResponse.json(
      { error: llmResult.error },
      { status: 500 }
    );
  }

  const trimmed = llmResult.text
    .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1")
    .trim();
  try {
    const parsedOut = JSON.parse(trimmed) as Record<string, unknown>;
    const suggestion =
      typeof parsedOut.suggestion === "string"
        ? parsedOut.suggestion
        : parsed.data.request;
    const type = ["label", "restructure", "explain", "simplify", "other"].includes(
      String(parsedOut.type)
    )
      ? (parsedOut.type as "label" | "restructure" | "explain" | "simplify" | "other")
      : "other";
    return NextResponse.json({ suggestion, type });
  } catch {
    return NextResponse.json({
      suggestion: llmResult.text.slice(0, 500),
      type: "other",
    });
  }
}
