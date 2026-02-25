/**
 * SILS — Student Information and Learning System
 * Root page placeholder. Tenant-aware dashboard will replace this.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-100">
        SILS
      </h1>
      <p className="mt-2 text-slate-400">
        Student Information and Learning System
      </p>
      <p className="mt-4 text-sm text-slate-500">
        AI-native multi-tenant LMS + optional SIS • Phase 0
      </p>
    </main>
  );
}
