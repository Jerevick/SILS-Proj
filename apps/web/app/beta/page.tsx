"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export default function BetaPage() {
  const [email, setEmail] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/beta/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          institutionName,
          contactName: contactName || undefined,
          role: role || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      setSubmitted(true);
      toast.success("You're on the list!", {
        description: "We'll reach out when we're ready for pilot institutions.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-space-950 flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center rounded-2xl glass border border-neon-cyan/25 p-10">
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            You're on the list
          </h1>
          <p className="text-slate-400 mb-6">
            We'll contact you when we're ready for pilot institutions. Thank you for your interest in SILS.
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-neon-cyan/20 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950 pt-20 pb-16 px-6">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-neon-cyan mb-8 inline-block"
        >
          ← Back to SILS
        </Link>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Join the beta
        </h1>
        <p className="text-slate-400 mb-10">
          Be among the first pilot institutions to use SILS — AI-native LMS and SIS. Join the waitlist and we'll reach out when we're ready.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl glass border border-white/10 p-8"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Institution name *
            </label>
            <input
              type="text"
              required
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
              placeholder="Acme University"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Contact email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
              placeholder="you@institution.edu"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Contact name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Your role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
              placeholder="e.g. Admin, Registrar, IT"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none resize-none"
              placeholder="Tell us about your use case..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neon-cyan px-5 py-3 text-sm font-semibold text-space-950 hover:bg-neon-cyan/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Joining…" : "Join waitlist"}
          </button>
        </form>
      </div>
    </div>
  );
}
