"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";

/**
 * Redirects to /terms/accept if the current user is in a tenant that has not accepted terms.
 * Use inside tenant-facing layouts/pages (e.g. dashboard).
 */
export function TermsGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  useEffect(() => {
    if (isLoading || !me) return;
    if (me.kind === "tenant" && !(me as { termsAcceptedAt?: string | null }).termsAcceptedAt) {
      router.replace("/terms/accept");
    }
  }, [me, isLoading, router]);

  if (me?.kind === "tenant" && !(me as { termsAcceptedAt?: string | null }).termsAcceptedAt) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Redirecting to terms…</p>
      </div>
    );
  }

  return <>{children}</>;
}
