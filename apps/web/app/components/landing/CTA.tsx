"use client";

import { motion } from "framer-motion";

export function CTA() {
  return (
    <section
      id="request-demo"
      className="relative z-10 py-24 lg:py-32"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-neon-cyan/10 via-transparent to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-4xl px-6 text-center"
      >
        <div className="glass-strong rounded-3xl border border-neon-cyan/20 p-12 lg:p-16 shadow-[0_0_60px_rgba(0,245,255,0.08)]">
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Ready to transform your campus?
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-slate-400">
            Join forward-thinking institutions using SILS. Request a demo and
            we&apos;ll show you how to go AI-native—your way.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#request-demo"
              className="rounded-xl bg-neon-cyan px-10 py-4 text-base font-semibold text-space-950 shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:shadow-[0_0_50px_rgba(0,245,255,0.5)] transition-shadow"
            >
              Request Demo
            </a>
            <a
              href="mailto:contact@sils.edu"
              className="rounded-xl glass px-10 py-4 text-base font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/30 hover:text-neon-cyan transition-colors"
            >
              Contact Sales
            </a>
          </div>
          <p className="mt-8 text-xs text-slate-500">
            No credit card required • Custom deployment options • FERPA-aligned
          </p>
        </div>
      </motion.div>
    </section>
  );
}
