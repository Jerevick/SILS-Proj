/**
 * GET /api/plagiarism/submission/[submissionId] — Latest (or specified) plagiarism report for a submission.
 * Phase 22: Full report for originality viewer. Scoped to tenant; only graders can view.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type PlagiarismReportApiPayload = {
  id: string;
  submissionId: string;
  overallScore: number;
  detailedMatches: Array<{
    source: string;
    similarityPct: number;
    excerpt: string;
    startOffset?: number;
    endOffset?: number;
    sourceUrl?: string;
  }>;
  reportUrl: string | null;
  checkedAt: string;
  provider: string;
  submissionContent: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { submissionId } = await params;
  const { searchParams } = new URL(_req.url);
  const reportId = searchParams.get("reportId");

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: { include: { course: true } },
        },
      },
      plagiarismReports: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.assignment.module.course.tenantId !== result.context.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let report = submission.plagiarismReports[0] ?? null;
  if (reportId && report?.id !== reportId) {
    const specific = await prisma.plagiarismReport.findFirst({
      where: { id: reportId, submissionId },
    });
    if (specific) report = specific;
  }
  if (!report) {
    return NextResponse.json(
      { error: "No plagiarism report found for this submission." },
      { status: 404 }
    );
  }

  const detailedMatches = (report.detailedMatches as Array<Record<string, unknown>>) ?? [];
  const payload: PlagiarismReportApiPayload = {
    id: report.id,
    submissionId: report.submissionId,
    overallScore: report.overallScore,
    detailedMatches: detailedMatches.map((m) => ({
      source: typeof m.source === "string" ? m.source : "Unknown",
      similarityPct: typeof m.similarityPct === "number" ? m.similarityPct : 0,
      excerpt: typeof m.excerpt === "string" ? m.excerpt : "",
      startOffset: typeof m.startOffset === "number" ? m.startOffset : undefined,
      endOffset: typeof m.endOffset === "number" ? m.endOffset : undefined,
      sourceUrl: typeof m.sourceUrl === "string" ? m.sourceUrl : undefined,
    })),
    reportUrl: report.reportUrl,
    checkedAt: report.checkedAt.toISOString(),
    provider: report.provider,
    submissionContent: submission.content,
  };

  return NextResponse.json(payload);
}
