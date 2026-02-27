"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

export function CTA() {
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
              Ready to transform your campus?
            </h2>
            <p className="mt-6 max-w-xl mx-auto text-slate-400 text-lg">
              Join forward-thinking institutions using SILS. Request a demo and
              we&apos;ll show you how to go AI-native—your way.
            </p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#request-demo"
                className="group rounded-xl bg-neon-cyan px-10 py-4 text-base font-semibold text-space-950 shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:shadow-[0_0_50px_rgba(0,245,255,0.5)] transition-all duration-300 flex items-center gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Request Demo
              </a>
              <a
                href="mailto:contact@sils.edu"
                className="group rounded-xl glass px-10 py-4 text-base font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/40 hover:text-neon-cyan transition-all duration-300 flex items-center gap-2"
              >
                Contact Sales
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <p className="mt-10 text-xs text-slate-500">
              No credit card required • Custom deployment options • FERPA-aligned
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
