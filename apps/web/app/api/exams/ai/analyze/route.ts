/**
 * POST /api/exams/ai/analyze — AI Result Analyzer for an examination.
 * Body: { examinationId: string, resultsData: Array<{ studentId, score?, grade?, feedback? }> }
 * Deep analysis, remediation suggestions, StudentCompetency updates.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { AIResultAnalyzer } from "@/app/actions/exam-actions";
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

  let body: { examinationId?: string; resultsData?: Array<{ studentId: string; score?: number; grade?: string; feedback?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { examinationId, resultsData } = body;
  if (!examinationId || typeof examinationId !== "string") {
    return NextResponse.json({ error: "examinationId is required" }, { status: 400 });
  }
  if (!Array.isArray(resultsData)) {
    return NextResponse.json({ error: "resultsData must be an array" }, { status: 400 });
  }

  const result = await AIResultAnalyzer(examinationId, resultsData);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    analysis: result.analysis,
  });
}
