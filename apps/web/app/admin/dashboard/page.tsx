import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-white">
            SILS Super Admin
          </span>
          <nav className="flex items-center gap-6">
            <Link
              href="/admin/dashboard"
              className="text-sm font-medium text-neon-cyan"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/requests"
              className="text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors"
            >
              Onboarding requests
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Super Admin Dashboard
        </h1>
        <p className="text-slate-400 mb-6">
          Manage onboarding requests and platform settings.
        </p>
        <Link
          href="/admin/requests"
          className="inline-flex items-center rounded-lg bg-neon-cyan/20 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
        >
          View onboarding requests
        </Link>
      </main>
    </div>
  );
}
