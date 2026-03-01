/**
 * Phase 29: Loading skeleton for (app) dashboard — shown while tenant/me is loading.
 */

export default function AppLoading() {
  return (
    <div className="min-h-screen bg-space-950 flex">
      <aside className="w-56 shrink-0 border-r border-white/5 p-4 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-24 mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 bg-white/5 rounded-lg w-full" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="h-8 bg-white/10 rounded w-48 mb-2 animate-pulse" />
        <div className="h-4 bg-white/5 rounded w-64 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
      </main>
    </div>
  );
}
