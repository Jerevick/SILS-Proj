"use client";

import { motion } from "framer-motion";

const cards = [
  {
    title: "AI from day one",
    desc: "Built for AI—not retrofitted. Every workflow anticipates intelligent assistants and automation.",
    icon: "◇",
  },
  {
    title: "One data model",
    desc: "Learning and administrative data live in one place. No sync delays, no duplicate records.",
    icon: "▣",
  },
  {
    title: "Deploy your way",
    desc: "LMS-only, hybrid, or full unified SIS. Same platform, flexible adoption path.",
    icon: "⬡",
  },
  {
    title: "Multi-tenant by design",
    desc: "Isolated tenants, shared infrastructure. Scale from one school to hundreds.",
    icon: "⬢",
  },
  {
    title: "Modern stack",
    desc: "Cloud-native, API-first. Integrate with anything; no legacy lock-in.",
    icon: "◈",
  },
  {
    title: "Privacy & compliance",
    desc: "FERPA-aware architecture and controls. Your data, your rules.",
    icon: "◎",
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
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Why <span className="text-neon-cyan">SILS</span>?
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-slate-400">
            The only platform designed from the ground up as AI-native and
            unified—so you don’t have to choose between LMS and SIS.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group glass rounded-2xl p-6 border border-white/5 hover:border-neon-cyan/20 transition-colors"
            >
              <div className="text-2xl text-neon-cyan mb-4 font-mono opacity-80 group-hover:opacity-100">
                {card.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-white mb-2">
                {card.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
