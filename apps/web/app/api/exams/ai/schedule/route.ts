/**
 * POST /api/exams/ai/schedule — AI Exam Scheduler for a term.
 * Body: { termId: string }
 * Uses LLM + optimization to schedule exams, generate seating, special arrangements.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { AIExamScheduler } from "@/app/actions/exam-actions";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { getTenantContext } from "@/lib/tenant-context";

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantResult = await getTenantContext(orgId, userId);
  const tenantId = tenantResult?.ok ? tenantResult.context.tenantId : null;
  const rate = await checkAiRateLimit(userId, tenantId);
  if (!rate.ok) {
    return NextResponse.json(
      { error: rate.error, retryAfter: rate.retryAfter },
      { status: 429 }
    );
  }

  let body: { termId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const termId = body.termId;
  if (!termId || typeof termId !== "string") {
    return NextResponse.json({ error: "termId is required" }, { status: 400 });
  }

  const result = await AIExamScheduler(termId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    scheduled: result.scheduled,
    insights: result.insights,
  });
}
