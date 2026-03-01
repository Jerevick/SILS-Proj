/**
 * POST /api/ai/orchestrator — AI Orchestrator API (the brain).
 * Body: { action: string, payload: Record<string, unknown>, tenantId?: string }.
 * Tenant from Clerk org; rate limited per tenant/user. Logs to SystemLog.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant-context";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { runOrchestrator, type OrchestratorAction } from "@/lib/ai/orchestrator";
import { streamLLM } from "@/lib/ai/llm-router";
import { LogSystemEvent, LogErrorEvent } from "@/app/actions/monitoring-actions";

const bodySchema = z.object({
  action: z.enum([
    "generate_course",
    "generate_module",
    "adaptive_pathway",
    "grade_submission",
    "detect_friction_and_intervene",
    "proactive_insights",
    "global_chat",
    "health_check",
    "semantic_search",
  ]),
  payload: z.record(z.unknown()).default({}),
  tenantId: z.string().optional(),
  stream: z.boolean().optional(),
});

export async function POST(request: Request) {
  const start = Date.now();
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const { tenantId, featureFlags } = tenantResult.context;

  if (featureFlags?.aiEnabled === false) {
    return NextResponse.json({ error: "AI features are disabled for this tenant" }, { status: 403 });
  }

  const rateLimit = await checkAiRateLimit(userId, tenantId);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: rateLimit.error, retryAfter: rateLimit.retryAfter },
      { status: 429, headers: rateLimit.retryAfter ? { "Retry-After": String(rateLimit.retryAfter) } : undefined }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { action, payload, stream: wantStream } = body;
  const effectivePayload = { ...payload, ...(body.tenantId ? { tenantId: body.tenantId } : {}) };

  if (wantStream && action === "global_chat") {
    const message = (effectivePayload.message as string) || (effectivePayload.query as string) || "";
    if (!message) {
      return NextResponse.json({ error: "message or query required for global_chat" }, { status: 400 });
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { ORCHESTRATOR_SYSTEM } = await import("@/lib/ai/prompts");
          for await (const chunk of streamLLM({
            systemPrompt: ORCHESTRATOR_SYSTEM + "\n\nAnswer concisely. Suggest SILS links when relevant.",
            messages: [
              ...((effectivePayload.history as Array<{ role: string; content: string }>) ?? []).map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              })),
              { role: "user" as const, content: message },
            ],
            preferredProvider: "claude",
            maxTokens: 1024,
            temperature: 0.3,
          })) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          await LogErrorEvent({ message: err, source: "ai_orchestrator", tenantId });
          controller.enqueue(encoder.encode(JSON.stringify({ error: err })));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  }

  try {
    const output = await runOrchestrator({
      action: action as OrchestratorAction,
      payload: effectivePayload,
      tenantId,
      userId,
      skipReview: action === "global_chat" || action === "health_check",
    });

    const latencyMs = Date.now() - start;
    await LogSystemEvent({
      tenantId,
      source: "ai_orchestrator",
      level: "info",
      message: `API orchestrator ${output.ok ? "ok" : "error"}: ${action}`,
      metadata: { action, userId, latencyMs, ok: output.ok },
    });

    if (!output.ok) {
      return NextResponse.json(
        { error: output.error, code: output.code },
        { status: output.code === "REFUSED" ? 403 : 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: output.result,
      summary: output.summary,
      model: output.model,
      usage: output.usage,
      latencyMs: output.latencyMs,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    await LogErrorEvent({
      message: err.message,
      stack: err.stack,
      source: "ai_orchestrator",
      tenantId,
      metadata: { action: body.action },
    });
    return NextResponse.json(
      { error: "Orchestrator failed", details: err.message },
      { status: 500 }
    );
  }
}
