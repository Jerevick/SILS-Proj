"use client";

/**
 * Phase 29: Sentry stub for error tracking.
 * - When NEXT_PUBLIC_SENTRY_DSN is set, integrate with @sentry/nextjs (install and init here).
 * - Until then, this exposes a no-op captureException so the global error boundary can call it safely.
 */
import { useEffect } from "react";

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error) => void;
      captureMessage?: (msg: string) => void;
    };
  }
}

export function SentryStub() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      // Production: initialize Sentry when DSN is set.
      // npm install @sentry/nextjs && configure with dsn, environment, tracesSampleRate, etc.
      // Until then, no-op so error boundary does not throw.
      window.Sentry = {
        captureException: (error: Error) => {
          console.error("[Sentry]", error);
          // Sentry.captureException(error);
        },
      };
    } else {
      window.Sentry = {
        captureException: (error: Error) => console.error("[SILS Error]", error),
      };
    }
  }, []);
  return null;
}
