/**
 * POST /api/competencies/search — PGVector similarity search for job mapping and recommendations.
 * Body: { query?: string, studentId?: string, limit?: number, minMastery?: number }
 * If query is provided, embeds it and returns similar StudentCompetencies (with competency details).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { getEmbeddingOrNull } from "@/lib/embeddings";
import { searchCompetenciesByVector } from "@/lib/competency-vector";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  query: z.string().optional(),
  studentId: z.string().optional(),
  limit: z.number().min(1).max(50).optional(),
  minMastery: z.number().min(0).max(1).optional(),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { tenantId } = result.context;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { query, studentId, limit = 20, minMastery = 0 } = parsed.data;

  try {
    let embedding: number[] | null = null;
    if (query && query.trim()) {
      embedding = await getEmbeddingOrNull(query.trim());
    }
    if (!embedding || embedding.length === 0) {
      return NextResponse.json({
        results: [],
        message: "No query or embedding failed; provide 'query' for similarity search.",
      });
    }

    const rows = await searchCompetenciesByVector(
      tenantId,
      embedding,
      limit,
      minMastery,
      studentId
    );

    const competencyIds = [...new Set(rows.map((r) => r.competencyId))];
    const competencies = await prisma.competency.findMany({
      where: { id: { in: competencyIds } },
      include: { programme: { select: { name: true, code: true } } },
    });
    const compMap = new Map(competencies.map((c) => [c.id, c]));

    const results = rows.map((r) => {
      const comp = compMap.get(r.competencyId);
      return {
        id: r.id,
        studentId: r.studentId,
        competencyId: r.competencyId,
        masteryLevel: r.masteryLevel,
        similarity: r.similarity,
        competency: comp
          ? {
              code: comp.code,
              title: comp.title,
              programme: comp.programme?.name,
              programmeCode: comp.programme?.code,
            }
          : null,
      };
    });

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Search competencies error:", e);
    return NextResponse.json(
      { error: "Failed to search competencies." },
      { status: 500 }
    );
  }
}
