"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "lms" | "hybrid" | "unified";

const modes: { id: Mode; label: string; short: string; desc: string }[] = [
  {
    id: "lms",
    label: "LMS-Only",
    short: "Learning first",
    desc: "Run SILS as a best-in-class learning management system. No SIS, no complexity—just courses, content, and analytics. Perfect for training orgs or schools that keep SIS elsewhere.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    short: "LMS + connect SIS",
    desc: "Use SILS as your LMS and connect to your existing SIS via secure APIs. Single sign-on, roster sync, and grade passback. Unify the experience without replacing your SIS.",
  },
  {
    id: "unified",
    label: "Unified",
    short: "One platform",
    desc: "Full student information system and learning management in one. Admissions, enrollment, academic records, and learning—all on SILS. One data model, one source of truth.",
  },
];

export function ModeToggle() {
  const [active, setActive] = useState<Mode>("hybrid");
  const current = modes.find((m) => m.id === active)!;

  return (
    <section id="modes" className="relative z-10 py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Choose your <span className="text-neon-purple">mode</span>
          </h2>
          <p className="mt-4 text-slate-400">
            Start where you are. Scale to where you want to be.
          </p>
        </motion.div>

        <div className="flex rounded-xl glass p-1.5 border border-white/10 gap-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActive(mode.id)}
              className={`flex-1 rounded-lg py-3 px-4 text-sm font-semibold transition-all ${
                active === mode.id
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-[0_0_20px_rgba(0,245,255,0.15)]"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="mt-8 rounded-2xl glass-strong border border-white/10 p-8"
          >
            <p className="font-mono text-xs uppercase tracking-widest text-neon-purple mb-2">
              {current.short}
            </p>
            <p className="text-slate-300 leading-relaxed">{current.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
