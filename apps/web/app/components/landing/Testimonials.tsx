"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    quote:
      "SILS replaced our legacy LMS and gave us a path to unify with SIS. The AI features are already saving our faculty hours every week.",
    name: "Dr. Sarah Chen",
    role: "VP Academic Technology, Pacific State University",
  },
  {
    quote:
      "We needed one platform that could scale across 40+ campuses. SILS multi-tenant model and API made it possible without a patchwork of tools.",
    name: "Marcus Webb",
    role: "CTO, North Atlantic University System",
  },
  {
    quote:
      "Finally—an LMS that doesn't feel like it was designed in 2005. Our students and instructors actually enjoy using it.",
    name: "Elena Rodriguez",
    role: "Director of Digital Learning, Riverside College",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative z-10 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Trusted by educators
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-slate-400">
            See what leaders in higher ed are saying about SILS.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-8 border border-white/5 flex flex-col"
            >
              <p className="text-slate-300 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-sm text-slate-500">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
