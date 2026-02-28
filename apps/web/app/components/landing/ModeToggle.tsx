"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Link2, LayoutGrid } from "lucide-react";

type Mode = "sis" | "lms" | "hybrid";

const modes: {
  id: Mode;
  label: string;
  short: string;
  desc: string;
  icon: typeof BookOpen;
  visual: string;
}[] = [
  {
    id: "sis",
    label: "SIS",
    short: "Student information first",
    desc: "Run SILS as a student information system. Admissions, enrollment, academic records—one source of truth. Ideal for institutions that want SIS-only or will add LMS later.",
    icon: LayoutGrid,
    visual: "Single pillar: admissions, enrollment, records, and reporting.",
  },
  {
    id: "lms",
    label: "LMS",
    short: "Learning first",
    desc: "Run SILS as a best-in-class learning management system. No SIS, no complexity—just courses, content, and analytics. Perfect for training orgs or schools that keep SIS elsewhere.",
    icon: BookOpen,
    visual: "Single pillar: courses, content, grades, analytics—all in one place.",
  },
  {
    id: "hybrid",
    label: "Hybrid (SIS+LMS)",
    short: "One platform",
    desc: "Full student information system and learning management in one. Admissions, enrollment, academic records, and learning—all on SILS. One data model, one source of truth.",
    icon: Link2,
    visual: "One stack: admissions, enrollment, records, courses, and learning—single source of truth.",
  },
];

export function ModeToggle() {
  const [active, setActive] = useState<Mode>("hybrid");
  const current = modes.find((m) => m.id === active)!;
  const Icon = current.icon;

  return (
    <section id="solutions" className="relative z-10 py-24 lg:py-32" aria-label="Interactive Mode Explorer">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Interactive Mode Explorer
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Start where you are. Scale to where you want to be. Toggle to see how each mode works.
          </p>
        </motion.div>

        <div className="flex rounded-xl glass p-1.5 border border-white/10 gap-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActive(mode.id)}
              className={`flex-1 rounded-lg py-3.5 px-4 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                active === mode.id
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 shadow-[0_0_24px_rgba(0,245,255,0.2)]"
                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="mt-8 rounded-2xl glass-strong border border-white/10 p-8 lg:p-10 shadow-[0_0_40px_rgba(0,245,255,0.05)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neon-purple/20 border border-neon-purple/30">
                <Icon className="h-5 w-5 text-neon-purple" />
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-neon-purple">
                {current.short}
              </p>
            </div>
            <p className="text-slate-300 leading-relaxed mb-6">{current.desc}</p>
            <div className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 font-mono text-sm text-slate-400">
              {current.visual}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
