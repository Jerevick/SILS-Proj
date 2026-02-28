/**
 * POST /api/competencies/issue-credential — Issue a Verifiable Credential for a student competency.
 * Uses VC-JWT stub (Veramo-style) and Hedera anchor stub; stores with vector embedding.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { createVCJwt, anchorOnHederaStub, type VCPayload } from "@/lib/verifiable-credential";
import { z } from "zod";

const bodySchema = z.object({
  studentId: z.string(),
  competencyId: z.string(),
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

  const { role, tenantId } = result.context;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body: studentId, competencyId required" }, { status: 400 });
  }

  const { studentId, competencyId } = parsed.data;
  const canIssue =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR" || studentId === userId;
  if (!canIssue) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sc = await prisma.studentCompetency.findFirst({
      where: { tenantId, studentId, competencyId },
      include: { competency: true },
    });
    if (!sc) {
      return NextResponse.json(
        { error: "Student competency record not found" },
        { status: 404 }
      );
    }

    const secret = process.env.VC_JWT_SECRET ?? process.env.CLERK_SECRET_KEY ?? "sils-vc-stub-secret";
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

    return NextResponse.json({
      id: vc.id,
      issuedAt: vc.issuedAt.toISOString(),
      blockchainTx: vc.blockchainTx,
      vcJwt,
    });
  } catch (e) {
    console.error("Issue credential error:", e);
    return NextResponse.json(
      { error: "Failed to issue credential." },
      { status: 500 }
    );
  }
}
