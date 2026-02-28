/**
 * GET/POST /api/ai/test — Test the LLM Router (and optionally rate limit).
 * GET: returns router status (cache/rate limit configured). POST: sends a sample prompt and returns router response.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { runLLMRouter } from "@/lib/ai/llm-router";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasRedis =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const rateLimitResult = await checkAiRateLimit(userId, null);

  return NextResponse.json({
    message: "AI router test endpoint",
    redisConfigured: hasRedis,
    rateLimit: rateLimitResult.ok
      ? "allowed"
      : rateLimitResult.error,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkAiRateLimit(userId, null);
  if (!rate.ok) {
    return NextResponse.json(
      { error: rate.error, retryAfter: rate.retryAfter },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const prompt =
    typeof body.prompt === "string"
      ? body.prompt
      : "In one sentence, what is 2 + 2? Reply with only the number and a brief explanation.";

  const result = await runLLMRouter({
    systemPrompt:
      "You are a helpful assistant. Answer concisely.",
    messages: [{ role: "user", content: prompt }],
    maxTokens: 256,
    cachePrefix: "router-test",
  });

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
