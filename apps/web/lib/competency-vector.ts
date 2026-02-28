/**
 * PGVector helpers for StudentCompetency.vectorEmbedding (1536-dim).
 * Prisma raw queries: pass vector as string "[0.1,0.2,...]".
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export type SimilarityRow = {
  id: string;
  studentId: string;
  competencyId: string;
  masteryLevel: number;
  similarity: number;
};

/**
 * Search StudentCompetency by vector similarity (cosine) for job mapping / recommendations.
 * Limit to tenant; optional studentId to scope to one student.
 */
export async function searchCompetenciesByVector(
  tenantId: string,
  embedding: number[],
  limit: number = 20,
  minMastery: number = 0,
  studentId?: string
): Promise<SimilarityRow[]> {
  const vectorStr = toVectorString(embedding);
  const rows = await prisma.$queryRaw<
    Array<{ id: string; studentId: string; competencyId: string; masteryLevel: number; similarity: string }>
  >(
    studentId
      ? Prisma.sql`
    SELECT sc.id, sc."studentId", sc."competencyId", sc."masteryLevel",
           1 - (sc."vectorEmbedding" <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)) AS similarity
    FROM "StudentCompetency" sc
    WHERE sc."tenantId" = ${tenantId} AND sc."studentId" = ${studentId}
      AND sc."vectorEmbedding" IS NOT NULL AND sc."masteryLevel" >= ${minMastery}
    ORDER BY sc."vectorEmbedding" <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)
    LIMIT ${limit}
  `
      : Prisma.sql`
    SELECT sc.id, sc."studentId", sc."competencyId", sc."masteryLevel",
           1 - (sc."vectorEmbedding" <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)) AS similarity
    FROM "StudentCompetency" sc
    WHERE sc."tenantId" = ${tenantId}
      AND sc."vectorEmbedding" IS NOT NULL AND sc."masteryLevel" >= ${minMastery}
    ORDER BY sc."vectorEmbedding" <=> (${Prisma.raw(`'${vectorStr}'`)}::vector)
    LIMIT ${limit}
  `
  );
  return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}
