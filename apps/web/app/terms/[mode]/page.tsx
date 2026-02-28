"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTermsContent, TERMS_MODE_LABELS, type TermsMode } from "@/lib/terms-content";

const VALID_MODES: TermsMode[] = ["sis", "lms", "hybrid"];

export default function TermsModePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = (params.mode as string)?.toLowerCase();
  const token = searchParams.get("token") ?? undefined;

  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validMode = VALID_MODES.includes(mode as TermsMode) ? (mode as TermsMode) : "lms";
  const { title, content } = getTermsContent(validMode);

  const handleAccept = async () => {
    setError(null);
    setAccepting(true);
    try {
      const res = await fetch("/api/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to record acceptance.");
        setAccepting(false);
        return;
      }
      if ((data as { alreadyAccepted?: boolean }).alreadyAccepted) {
        if (token) {
          window.location.href = "/sign-in?afterSignInUrl=/dashboard";
        } else {
          router.push("/dashboard");
        }
        return;
      }
      setAccepted(true);
      setAccepting(false);
      if (token) {
        window.location.href = "/sign-in?afterSignInUrl=/dashboard";
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  };

  if (accepted && token) {
    return (
      <div className="min-h-screen bg-space-950 text-slate-200 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <p className="text-lg text-white font-medium mb-2">Terms and conditions have been accepted.</p>
          <p className="text-slate-400 text-sm">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950 text-slate-200 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-neon-cyan mb-6 inline-block"
        >
          ← Back to SILS
        </Link>
        <div className="rounded-2xl border border-white/10 bg-space-900/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h1 className="font-display text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {TERMS_MODE_LABELS[validMode]}
            </p>
          </div>
          <div className="p-6 max-h-[60vh] overflow-y-auto prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-slate-300 text-sm leading-relaxed">
              {content.trim()}
            </pre>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-space-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              {token
                ? "This link identifies your institution. Accept the terms below, then sign in to access your dashboard. You cannot sign in until you have accepted."
                : "Sign in to accept these terms for your institution."}
            </p>
            <div className="flex gap-3">
              {token ? (
                <>
                  <span className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-500 border-transparent bg-transparent cursor-not-allowed">
                    Sign in (after accepting)
                  </span>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="rounded-lg bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-space-950 hover:bg-neon-cyan/90 disabled:opacity-50 transition-colors"
                  >
                    {accepting ? "Accepting…" : "I accept these terms"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard"
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
                </>
              )}
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
