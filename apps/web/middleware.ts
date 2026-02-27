import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/onboarding",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/onboarding/request",
  "/api/health",
  "/api/db",
]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAuthCallback = createRouteMatcher(["/auth/callback"]);
const isOnboardingRequestsApi = createRouteMatcher(["/api/onboarding/requests(.*)"]);

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  if (isAuthCallback(req)) return;

  const { userId, orgId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  const isSuperAdmin = SUPER_ADMIN_CLERK_USER_IDS.includes(userId);

  if (isAdminRoute(req)) {
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return;
  }

  if (isOnboardingRequestsApi(req)) {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return;
  }

  if (isDashboardRoute(req) || isAppRoute(req)) {
    if (isSuperAdmin && req.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    if (!isSuperAdmin && !orgId) {
      return NextResponse.redirect(new URL("/no-organization", req.url));
    }
    return;
  }

  if (req.nextUrl.pathname === "/no-organization") {
    if (orgId || isSuperAdmin) {
      return NextResponse.redirect(
        new URL(isSuperAdmin ? "/admin/dashboard" : "/dashboard", req.url)
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
