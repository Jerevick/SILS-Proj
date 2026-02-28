import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function DashboardPage() {
  const { orgSlug, userId } = await auth();
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-white">SILS</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {orgSlug ?? "Institution"} · Dashboard
            </span>
            <Link
              href="/"
              className="text-sm text-neon-cyan hover:underline"
            >
              Home
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Dashboard
        </h1>
        <p className="text-slate-400">
          Institution admin dashboard. Content coming in a later phase.
        </p>
        {isDev && userId && (
          <div className="mt-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 max-w-xl">
            <p className="text-sm font-medium text-amber-200 mb-1">
              App owner access
            </p>
            <p className="text-sm text-slate-300 mb-2">
              To open the <strong>Super Admin</strong> dashboard (manage all
              institutions), add your Clerk user ID to{" "}
              <code className="bg-white/10 px-1 rounded">
                SUPER_ADMIN_CLERK_USER_IDS
              </code>{" "}
              in <code className="bg-white/10 px-1 rounded">apps/web/.env.local</code>, then restart the app and sign in again (or go to{" "}
              <Link href="/auth/callback" className="text-neon-cyan hover:underline">
                /auth/callback
              </Link>
              ).
            </p>
            <p className="text-xs text-slate-400">
              Your Clerk user ID: <code className="bg-white/10 px-1 rounded break-all">{userId}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
