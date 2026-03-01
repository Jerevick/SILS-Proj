"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export function CTA() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Simulate submit; wire to your API later
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <section
      id="request-demo"
      className="relative z-10 py-24 lg:py-32"
      aria-label="Request a demo"
    >
      <span id="pricing" className="scroll-mt-24 block h-0 overflow-hidden" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-neon-cyan/10 via-transparent to-transparent pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-4xl px-6 text-center"
      >
        <div className="glass-strong rounded-3xl border border-neon-cyan/25 p-12 lg:p-20 shadow-[0_0_80px_rgba(0,245,255,0.1)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 pointer-events-none" />
          <div className="relative">
            <h2 className="font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Ready to transform your institution?
            </h2>
            <p className="mt-6 max-w-xl mx-auto text-slate-400 text-lg">
              Join forward-thinking institutions using SILS. Request a demo and
              we&apos;ll show you how to go AI-native—your way.
            </p>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-12 py-8 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20"
              >
                <p className="text-neon-cyan font-semibold">Request received.</p>
                <p className="text-slate-400 text-sm mt-1">We&apos;ll be in touch shortly.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-12 text-left max-w-md mx-auto space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                    placeholder="Dr. Jane Smith"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-1.5">
                    Work email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                    placeholder="jane@university.edu"
                  />
                </div>
                <div>
                  <label htmlFor="institution" className="block text-sm font-medium text-slate-400 mb-1.5">
                    Institution
                  </label>
                  <input
                    id="institution"
                    name="institution"
                    type="text"
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-colors"
                    placeholder="Pacific State University"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-400 mb-1.5">
                    Message (optional)
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 transition-colors resize-none"
                    placeholder="Tell us about your goals..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-neon-cyan px-10 py-4 text-base font-semibold text-space-950 shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:shadow-[0_0_50px_rgba(0,245,255,0.5)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  <Sparkles className="h-5 w-5" />
                  {loading ? "Sending…" : "Request Demo"}
                </button>
              </form>
            )}

            <p className="mt-10 text-xs text-slate-500">
              No credit card required • Custom deployment options • FERPA-aligned
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
