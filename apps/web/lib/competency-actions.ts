/**
 * Phase 9: Shared logic for IssueCredential, SearchCompetencies, UpdateMasteryFromLMS.
 * Used by API routes and server actions.
 */

import { prisma } from "@/lib/db";
import { createVCJwt, anchorOnHederaStub, type VCPayload } from "@/lib/verifiable-credential";
import { getEmbeddingOrNull } from "@/lib/embeddings";
import { searchCompetenciesByVector, toVectorString } from "@/lib/competency-vector";

export async function issueCredentialInternal(
  tenantId: string,
  studentId: string,
  competencyId: string
) {
  const sc = await prisma.studentCompetency.findFirst({
    where: { tenantId, studentId, competencyId },
    include: { competency: true },
  });
  if (!sc) return { ok: false as const, error: "Student competency not found" };

  const secret =
    process.env.VC_JWT_SECRET ?? process.env.CLERK_SECRET_KEY ?? "sils-vc-stub-secret";
  const payload: VCPayload = {
    sub: studentId,
    iss: `sils-tenant-${tenantId}`,
    credentialSubject: {
      id: studentId,
      competencyId: sc.competencyId,
      competencyCode: sc.competency.code,
      competencyTitle: sc.competency.title,
      masteryLevel: sc.masteryLevel,
      issuedBy: tenantId,
      programmeId: sc.competency.programmeId,
    },
    iat: Math.floor(Date.now() / 1000),
  };

  const vcJwt = createVCJwt(payload, secret);
  const credentialHash = Buffer.from(vcJwt).toString("base64url");
  const blockchainTx = await anchorOnHederaStub(credentialHash);

  const vc = await prisma.verifiableCredential.create({
    data: {
      tenantId,
      studentId,
      competencyId,
      vcJwt,
      blockchainTx,
      status: "ISSUED",
    },
  });

  return {
    ok: true as const,
    id: vc.id,
    issuedAt: vc.issuedAt.toISOString(),
    blockchainTx: vc.blockchainTx,
    vcJwt,
  };
}

export async function searchCompetenciesInternal(
  tenantId: string,
  query: string,
  options?: { studentId?: string; limit?: number; minMastery?: number }
) {
  const embedding = await getEmbeddingOrNull(query.trim());
  if (!embedding?.length) return { ok: true as const, results: [] };

  const limit = options?.limit ?? 20;
  const minMastery = options?.minMastery ?? 0;
  const rows = await searchCompetenciesByVector(
    tenantId,
    embedding,
    limit,
    minMastery,
    options?.studentId
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
  return { ok: true as const, results };
}

export async function updateMasteryFromLMSInternal(
  tenantId: string,
  studentId: string,
  programmeModuleId: string,
  options?: { grade?: string; completedAt?: string }
) {
  const programmeModule = await prisma.programmeModule.findFirst({
    where: { id: programmeModuleId, programme: { department: { tenantId } } },
    include: { programme: { include: { competencies: true } } },
  });
  if (!programmeModule)
    return { ok: false as const, error: "Programme module not found" };
  const competencies = programmeModule.programme.competencies;
  if (competencies.length === 0)
    return { ok: true as const, updated: 0, message: "No competencies linked" };

  const evidenceJson = {
    programmeModuleId,
    programmeModuleTitle: programmeModule.title,
    completedAt: options?.completedAt ?? new Date().toISOString(),
    grade: options?.grade,
  };
  const masteryLevel = 0.85;

  for (const comp of competencies) {
    await prisma.studentCompetency.upsert({
      where: {
        tenantId_studentId_competencyId: { tenantId, studentId, competencyId: comp.id },
      },
      create: { tenantId, studentId, competencyId: comp.id, masteryLevel, evidenceJson },
      update: { masteryLevel, evidenceJson: evidenceJson as object },
    });
    const textForEmbedding = `${comp.title} ${comp.description ?? ""} ${comp.code}`.trim();
    const embedding = await getEmbeddingOrNull(textForEmbedding);
    if (embedding?.length) {
      const vectorStr = toVectorString(embedding);
      await prisma.$executeRawUnsafe(
        `UPDATE "StudentCompetency" SET "vectorEmbedding" = $1::vector, "lastUpdated" = NOW() WHERE "tenantId" = $2 AND "studentId" = $3 AND "competencyId" = $4`,
        vectorStr,
        tenantId,
        studentId,
        comp.id
      );
    }
  }
  return { ok: true as const, updated: competencies.length };
}
