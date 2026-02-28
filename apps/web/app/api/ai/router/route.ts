/**
 * POST /api/ai/router — LLM Router API.
 * Complexity scoring, Redis cache (Upstash/Vercel KV), fallback Claude → GPT.
 * Per-user and per-tenant rate limiting applied.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { runLLMRouter, type RouterRequest } from "@/lib/ai/llm-router";
import { getTenantContext } from "@/lib/tenant-context";

const bodySchema = {
  systemPrompt: (v: unknown) => typeof v === "string",
  messages: (v: unknown) =>
    Array.isArray(v) &&
    (v as unknown[]).every(
      (m) => {
        if (typeof m !== "object" || m === null || !("role" in m) || !("content" in m)) return false;
        const role = (m as { role: string }).role;
        return (role === "user" || role === "assistant") && typeof (m as { content: unknown }).content === "string";
      }
    ),
  preferredProvider: (v: unknown) =>
    v === undefined || ["claude", "openai", "grok"].includes(v as string),
  maxTokens: (v: unknown) => v === undefined || (typeof v === "number" && v > 0 && v <= 8192),
  cachePrefix: (v: unknown) => v === undefined || typeof v === "string",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await auth();
  const tenantResult = orgId ? await getTenantContext(orgId, userId) : null;
  const tenantId = tenantResult?.ok ? tenantResult.context.tenantId : null;

  const rate = await checkAiRateLimit(userId, tenantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: rate.error, retryAfter: rate.retryAfter },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("systemPrompt" in body) ||
    !("messages" in body) ||
    !bodySchema.systemPrompt(body.systemPrompt) ||
    !bodySchema.messages(body.messages)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid systemPrompt / messages" },
      { status: 400 }
    );
  }

  const systemPrompt = body.systemPrompt as string;
  const messages = body.messages as { role: "user" | "assistant"; content: string }[];
  const preferredProvider = bodySchema.preferredProvider(body.preferredProvider)
    ? (body.preferredProvider as RouterRequest["preferredProvider"])
    : undefined;
  const maxTokens = bodySchema.maxTokens(body.maxTokens)
    ? (body.maxTokens as number)
    : undefined;
  const cachePrefix = bodySchema.cachePrefix(body.cachePrefix)
    ? (body.cachePrefix as string)
    : undefined;

  const routerReq: RouterRequest = {
    systemPrompt,
    messages,
    preferredProvider,
    maxTokens,
    cachePrefix,
  };

  const result = await runLLMRouter(routerReq);

  if (result.ok) {
    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      cached: result.cached,
      complexityScore: result.complexityScore,
    });
  }

  return NextResponse.json(
    { error: result.error, provider: result.provider },
    { status: 502 }
  );
}
