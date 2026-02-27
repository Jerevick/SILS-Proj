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
    <section className="relative z-10 border-y border-white/5 py-20" id="for-institutions" aria-label="Trusted by universities">
      <div className="mx-auto max-w-7xl px-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-xs font-medium uppercase tracking-[0.25em] text-slate-500 mb-12"
        >
          Trusted by leading universities worldwide
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-x-20 gap-y-10"
        >
          {logos.map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0.6 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="font-display text-lg font-semibold text-slate-500/80 hover:text-slate-300 transition-colors cursor-default"
            >
              {name}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
