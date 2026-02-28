/**
 * Signed token for terms acceptance link. Allows institution contact to accept
 * terms without being logged in. Tokens can be tenant-scoped (after approval) or
 * request-scoped (quotation email). The terms URL is unique per institution/request
 * so we can track which institution accepted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.TERMS_ACCEPTANCE_SECRET ?? process.env.CLERK_SECRET_KEY ?? "dev-terms-secret";
const EXPIRY_DAYS = 14;

const REQUEST_PREFIX = "req:";

export function createTermsAcceptanceToken(tenantId: string): string {
  const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${tenantId}:${expiry}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/** Request-scoped token for quotation email (no tenant yet). */
export function createRequestTermsAcceptanceToken(requestId: string): string {
  const expiry = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${REQUEST_PREFIX}${requestId}:${expiry}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export type TermsTokenPayload =
  | { kind: "tenant"; tenantId: string }
  | { kind: "request"; requestId: string };

export function verifyTermsAcceptanceToken(token: string): TermsTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const sig = parts.pop();
    if (!sig) return null;
    const expiryStr = parts.pop();
    if (!expiryStr) return null;
    const expiry = Number(expiryStr);
    if (Number.isNaN(expiry) || expiry < Date.now()) return null;

    const isRequest = parts[0] === "req";
    const payloadForSig = parts.join(":") + ":" + expiryStr;
    const expected = createHmac("sha256", SECRET).update(payloadForSig).digest("hex");
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;

    if (isRequest) {
      const requestId = parts.length > 1 ? parts.slice(1).join(":") : "";
      return requestId ? { kind: "request", requestId } : null;
    }
    const tenantId = parts.join(":");
    return tenantId ? { kind: "tenant", tenantId } : null;
  } catch {
    return null;
  }
}

/** Terms mode for URL path (sis, lms, hybrid). */
export type TermsUrlMode = "sis" | "lms" | "hybrid";

/**
 * Build the institution-unique terms acceptance URL (tenant-scoped).
 * Use after approval when we have a tenant.
 */
export function buildInstitutionTermsAcceptUrl(
  tenantId: string,
  termsMode: TermsUrlMode,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, "");
  const token = createTermsAcceptanceToken(tenantId);
  return `${base}/terms/${termsMode}?token=${encodeURIComponent(token)}`;
}

/**
 * Build the request-unique terms acceptance URL (request-scoped).
 * Use in the quotation email (with invoice PDF and payment links) so we can track
 * which institution accepted terms before approval.
 */
export function buildRequestTermsAcceptUrl(
  requestId: string,
  termsMode: TermsUrlMode,
  baseUrl: string
): string {
  const base = baseUrl.replace(/\/$/, "");
  const token = createRequestTermsAcceptanceToken(requestId);
  return `${base}/terms/${termsMode}?token=${encodeURIComponent(token)}`;
}
