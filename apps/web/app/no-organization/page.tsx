import Link from "next/link";

export default function NoOrganizationPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-space-950 px-6">
      <div className="max-w-md text-center glass-strong rounded-2xl border border-white/10 p-10">
        <h1 className="font-display text-2xl font-bold text-white mb-2">
          No institution yet
        </h1>
        <p className="text-slate-400 mb-6">
          Your account is not yet linked to an institution. Institutions are
          created only when you submit a pilot request with your institution
          details. Use the button below to start that process.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/onboarding"
            className="rounded-lg bg-neon-cyan/20 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            Start pilot
          </Link>
          <Link
            href="/"
            className="rounded-lg glass px-5 py-2.5 text-sm font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/40 hover:text-neon-cyan transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
