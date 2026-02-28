"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTermsContent, type TermsMode } from "@/lib/terms-content";

function modeFromDeploymentMode(dm: string): TermsMode {
  if (dm === "SIS") return "sis";
  if (dm === "HYBRID") return "hybrid";
  return "lms";
}

export default function TermsAcceptPage() {
  const router = useRouter();
  const [mode, setMode] = useState<TermsMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/me");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.kind === "tenant" && data.deploymentMode) {
        setMode(modeFromDeploymentMode(data.deploymentMode));
      } else {
        setMode("lms");
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleAccept = async () => {
    setError(null);
    setAccepting(true);
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to record acceptance.");
        setAccepting(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  };

  if (loading || mode === null) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  const { title, content } = getTermsContent(mode);

  return (
    <div className="min-h-screen bg-space-950 text-slate-200 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h1 className="font-display text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              You must accept these terms to access your institution dashboard.
            </p>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-slate-300 text-sm leading-relaxed">
              {content.trim()}
            </pre>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-space-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              By clicking &quot;I accept&quot; you agree on behalf of your institution.
            </p>
            <div className="flex gap-3">
              <Link
                href="/"
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors text-center"
              >
                Back
              </Link>
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="rounded-lg bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-space-950 hover:bg-neon-cyan/90 disabled:opacity-50 transition-colors"
              >
                {accepting ? "Accepting…" : "I accept these terms"}
              </button>
            </div>
          </div>
          {error && (
            <p className="px-6 pb-4 text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
