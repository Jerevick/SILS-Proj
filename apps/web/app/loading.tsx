/**
 * Phase 29: Global loading skeleton — shown while root layout or page is loading.
 */

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-space-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-neon-cyan/50 border-t-neon-cyan animate-spin" />
        <p className="text-slate-400 text-sm">Loading SILS…</p>
      </div>
    </div>
  );
}
