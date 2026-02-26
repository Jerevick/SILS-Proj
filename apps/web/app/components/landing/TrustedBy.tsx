"use client";

import { motion } from "framer-motion";

const logos = [
  "Stanford University",
  "MIT",
  "Oxford",
  "Berkeley",
  "Cambridge",
  "ETH Zurich",
];

export function TrustedBy() {
  return (
    <section className="relative z-10 border-y border-white/5 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-sm font-medium uppercase tracking-widest text-slate-500 mb-10"
        >
          Trusted by leading universities worldwide
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8"
        >
          {logos.map((name, i) => (
            <span
              key={name}
              className="font-display text-lg font-semibold text-slate-500/80 hover:text-slate-400 transition-colors"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
