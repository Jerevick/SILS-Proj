"use client";

import { motion } from "framer-motion";

const items = [
  "Personalized learning paths",
  "Smart course recommendations",
  "Automated grading & feedback",
  "Natural language search across all content",
  "Predictive analytics & early alerts",
  "AI teaching assistants",
];

export function AIAtCore() {
  return (
    <section id="ai" className="relative z-10 py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/5 via-transparent to-neon-cyan/5" />
      <div className="mx-auto max-w-7xl px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            AI at the <span className="text-neon-cyan">core</span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-slate-400">
            Not a bolt-on. SILS is built for AI from the ground up—so every
            feature can be smarter.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-4 rounded-xl glass border border-white/5 px-5 py-4 group hover:border-neon-cyan/20"
            >
              <span className="h-2 w-2 rounded-full bg-neon-cyan shrink-0 group-hover:shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
              <span className="text-slate-300 font-medium">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
