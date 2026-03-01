"use server";

/**
 * Phase 27: AI System-Wide Orchestrator — server actions.
 * Run orchestrator, list insights, apply insight (mark as applied / navigate), global AI chat.
 */

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runAISystemOrchestrator } from "@/lib/ai/system-orchestrator";
import { runLLMRouter } from "@/lib/ai/llm-router";

const ORCHESTRATOR_PATH = "/ai/orchestrator";

/** Get current tenant or return error. */
async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return { ok: true as const, ...tenantResult.context };
}

/** Run the system-wide orchestrator (on-demand or from schedule). Stores insights for dashboard. */
export async function runSystemOrchestrator(options?: { dryRun?: boolean }) {
  const ctx = await requireTenant();
  if (!ctx.ok) return ctx;

  const result = await runAISystemOrchestrator({
    tenantId: ctx.tenantId,
    dryRun: options?.dryRun ?? false,
  });

  revalidatePath(ORCHESTRATOR_PATH);
  return result;
}

export type SystemInsightRow = {
  id: string;
  insightType: string;
  title: string;
  description: string;
  confidenceScore: number;
  actionLink: string | null;
  actionPayload: unknown;
  appliedAt: Date | null;
  createdAt: Date;
};

/** List recent system insights for the current tenant (for dashboard feed). */
export async function getSystemInsights(options?: { limit?: number }) {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false as const, error: ctx.error, insights: [] };

  const limit = options?.limit ?? 50;
  const rows = await prisma.systemInsight.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const insights: SystemInsightRow[] = rows.map((r) => ({
    id: r.id,
    insightType: r.insightType,
    title: r.title,
    description: r.description,
    confidenceScore: r.confidenceScore,
    actionLink: r.actionLink,
    actionPayload: r.actionPayload,
    appliedAt: r.appliedAt,
    createdAt: r.createdAt,
  }));

  return { ok: true as const, insights };
}

/** Mark an insight as applied (one-click apply from dashboard). Optionally persist side effect. */
export async function applySystemInsight(insightId: string) {
  const ctx = await requireTenant();
  if (!ctx.ok) return ctx;

  const insight = await prisma.systemInsight.findFirst({
    where: { id: insightId, tenantId: ctx.tenantId },
  });
  if (!insight) return { ok: false as const, error: "Insight not found" };

  await prisma.systemInsight.update({
    where: { id: insightId },
    data: { appliedAt: new Date() },
  });

  revalidatePath(ORCHESTRATOR_PATH);
  return { ok: true as const };
}

/** Global AI chat: "Optimize this semester's timetable", "Find equity gaps", etc. Uses LLM_Router (Claude). */
export async function globalAIChat(message: string, history?: { role: "user" | "assistant"; content: string }[]) {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false as const, error: ctx.error, text: "" };

  const systemPrompt = `You are the central AI assistant for SILS (Student Information and Learning System), an AI-native multi-tenant SaaS combining LMS and SIS. You have access to the same cross-module context as the System Orchestrator. Answer concisely and suggest specific actions or links (e.g. /scheduling, /exams, /finance/invoices, /sis/equity) when relevant. If the user asks to optimize timetables, find equity gaps, or similar, give actionable recommendations and point to the relevant SILS modules.`;

  const messages = [
    ...(history ?? []),
    { role: "user" as const, content: message },
  ];

  const result = await runLLMRouter({
    systemPrompt,
    messages,
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "global-chat",
  });

  if (!result.ok) return { ok: false as const, error: result.error, text: "" };
  return { ok: true as const, text: result.text };
}
