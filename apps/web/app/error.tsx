"use client";

/**
 * Phase 29: Global error boundary — catches uncaught errors in the app tree.
 * Renders a friendly message and option to go home; in production Sentry can capture the error.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { Sentry?: { captureException?: (e: Error) => void } }).Sentry?.captureException) {
      (window as unknown as { Sentry: { captureException: (e: Error) => void } }).Sentry.captureException(error);
    } else {
      console.error("[SILS Global Error]", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md text-center rounded-2xl border border-white/10 bg-white/5 p-10">
        <h1 className="font-display text-xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          We've been notified and are looking into it. You can try again or return home.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-neon-cyan/20 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-slate-200 border border-white/10 hover:bg-white/15 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
