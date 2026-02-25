import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Header used to pass tenant when not using subdomain */
const TENANT_HEADER = "x-tenant-slug";

/**
 * Tenant detection: subdomain (e.g. acme.sils.app) or x-tenant-slug header.
 * Sets request headers for downstream so layout/API can read tenant.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? "";
  const tenantFromHeader = request.headers.get(TENANT_HEADER);

  // Allow PWA and static assets without tenant resolution
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/manifest") ||
    url.pathname.startsWith("/sw") ||
    url.pathname.startsWith("/workbox") ||
    url.pathname.startsWith("/icons") ||
    url.pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let tenantSlug: string | null = null;

  if (tenantFromHeader) {
    tenantSlug = tenantFromHeader.trim();
  } else {
    // Subdomain: e.g. acme.sils.app -> acme (skip "www")
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "www") {
      tenantSlug = parts[0];
    }
  }

  const response = NextResponse.next();
  if (tenantSlug) {
    response.headers.set("x-tenant-slug", tenantSlug);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/health).*)"],
};
