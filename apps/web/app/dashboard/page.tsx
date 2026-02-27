import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export default async function DashboardPage() {
  const { orgSlug } = await auth();
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
      </main>
    </div>
  );
}
