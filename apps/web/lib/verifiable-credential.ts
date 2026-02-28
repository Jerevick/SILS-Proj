/**
 * Phase 9: Verifiable Credential stub — VC-JWT generation and Hedera anchor stub.
 * Replace with Veramo + real Hedera when moving to production.
 */

import { createHmac } from "crypto";

export type VCPayload = {
  sub: string; // student ID (Clerk)
  credentialSubject: {
    id: string;
    competencyId: string;
    competencyCode: string;
    competencyTitle: string;
    masteryLevel: number;
    issuedBy: string;
    programmeId?: string;
  };
  iss: string;
  iat: number;
  exp?: number;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64UrlEncodeJson(obj: object): string {
  return base64UrlEncode(Buffer.from(JSON.stringify(obj), "utf-8"));
}

/**
 * Create a VC-JWT (stub: HMAC-SHA256 signed; production would use Veramo + DID).
 */
export function createVCJwt(payload: VCPayload, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson({
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
  });
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

/**
 * Stub: anchor credential hash on Hedera (or similar). Returns a fake tx hash for now.
 */
export async function anchorOnHederaStub(_credentialHash: string): Promise<string> {
  // In production: call Hedera SDK to submit hash to topic or contract.
  const stubTx = `0x${Buffer.from(`sils-vc-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString("hex").slice(0, 64)}`;
  return stubTx;
}
