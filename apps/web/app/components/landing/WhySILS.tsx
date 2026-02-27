"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Network,
  Glasses,
  Layers,
  Shield,
  Heart,
} from "lucide-react";

const cards = [
  {
    title: "Agentic AI",
    desc: "AI agents that act on behalf of learners and faculty—tutoring, grading, and administrative tasks—with full audit trails and control.",
    icon: Bot,
    gradient: "from-neon-cyan/20 to-neon-cyan/5",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(0,245,255,0.15)]",
  },
  {
    title: "Portable Skills Graph",
    desc: "Skills and competencies travel with the learner. Map outcomes to credentials and jobs; no lock-in to a single institution.",
    icon: Network,
    gradient: "from-neon-purple/20 to-neon-purple/5",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
  },
  {
    title: "Native XR Labs",
    desc: "Built-in virtual and augmented labs. Run immersive simulations and spatial learning without third-party boltons.",
    icon: Glasses,
    gradient: "from-blue-500/20 to-blue-500/5",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
  },
  {
    title: "Blended Modes",
    desc: "LMS-only, hybrid with your SIS, or fully unified. Same platform—choose the deployment that fits your roadmap.",
    icon: Layers,
    gradient: "from-neon-cyan/15 to-neon-purple/10",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(0,245,255,0.1)]",
  },
  {
    title: "Scoped Governance",
    desc: "Role-based access, data residency, and compliance controls. FERPA-aware by design; your policies, enforced everywhere.",
    icon: Shield,
    gradient: "from-neon-purple/15 to-neon-cyan/10",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]",
  },
  {
    title: "Equity-First",
    desc: "Accessibility, inclusive design, and equitable outcomes built in. Analytics that surface gaps—and tools to close them.",
    icon: Heart,
    gradient: "from-neon-pink/15 to-neon-purple/10",
    borderGlow: "group-hover:shadow-[0_0_30px_rgba(236,72,153,0.1)]",
  },
];

export function WhySILS() {
  return (
    <section id="why-sils" className="relative z-10 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Why <span className="text-neon-cyan">SILS</span>?
          </h2>
          <p className="mt-5 max-w-2xl mx-auto text-slate-400 text-lg">
            The only platform designed from the ground up as AI-native and
            unified—so you don&apos;t have to choose between LMS and SIS.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className={`group relative rounded-2xl p-6 lg:p-8 bg-gradient-to-br ${card.gradient} glass border border-white/10 hover:border-neon-cyan/25 transition-all duration-300 ${card.borderGlow}`}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="inline-flex p-3 rounded-xl bg-white/5 border border-white/10 mb-5 text-neon-cyan group-hover:shadow-[0_0_20px_rgba(0,245,255,0.2)] transition-shadow">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-white mb-3">
                    {card.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
