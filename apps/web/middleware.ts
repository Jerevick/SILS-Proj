import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isSuperAdminEdge } from "@/lib/platform-auth-edge";

export default clerkMiddleware(async (auth, req) => {
  const isPublicRoute = createRouteMatcher([
    "/",
    "/onboarding",
    "/invoice(.*)",
    "/pay(.*)",
    "/receipt(.*)",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/terms(.*)",
    "/api/terms/accept",
    "/api/onboarding/request",
    "/api/health",
    "/api/db",
    "/api/invoice(.*)",
    "/api/pay(.*)",
    "/api/receipt(.*)",
    "/api/webhooks/stripe",
  ]);
  const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
  const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
  const isAuthCallback = createRouteMatcher(["/auth/callback"]);
  const isOnboardingRequestsApi = createRouteMatcher(["/api/onboarding/requests(.*)"]);
  const isAdminApi = createRouteMatcher(["/api/admin(.*)"]);

  if (isPublicRoute(req)) return;
  if (isAuthCallback(req)) return;

  const { userId, orgId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Edge-only: env-configured super admins (no Prisma). Used for dashboard redirect only.
  const isEnvSuperAdmin = await isSuperAdminEdge(userId);

  if (isAdminRoute(req)) {
    // Allow; API and pages (Node) enforce full platform check with Prisma
    return;
  }

  if (isOnboardingRequestsApi(req)) {
    return;
  }

  if (isAdminApi(req)) {
    return;
  }

  if (isDashboardRoute(req) || isAppRoute(req)) {
    if (isEnvSuperAdmin && req.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    if (!isEnvSuperAdmin && !orgId) {
      return NextResponse.redirect(new URL("/no-organization", req.url));
    }
    return;
  }

  if (req.nextUrl.pathname === "/no-organization") {
    if (orgId || isEnvSuperAdmin) {
      return NextResponse.redirect(
        new URL(isEnvSuperAdmin ? "/admin/dashboard" : "/dashboard", req.url)
      );
    }
    return;
  }
});

function isAppRoute(req: { nextUrl: { pathname: string } }) {
  const path = req.nextUrl.pathname;
  return (
    path.startsWith("/dashboard") ||
    (path.startsWith("/") &&
      !path.startsWith("/sign-in") &&
      !path.startsWith("/sign-up") &&
      !path.startsWith("/onboarding") &&
      !path.startsWith("/invoice") &&
      !path.startsWith("/pay") &&
      !path.startsWith("/receipt") &&
      !path.startsWith("/api") &&
      path !== "/" &&
      path !== "/auth/callback" &&
      path !== "/no-organization")
  );
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
