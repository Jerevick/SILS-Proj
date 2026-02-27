"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

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
              className="group relative rounded-2xl p-8 glass border border-white/5 hover:border-neon-cyan/20 hover:shadow-[0_0_40px_rgba(0,245,255,0.06)] transition-all duration-300 flex flex-col overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Quote className="absolute top-6 right-6 h-8 w-8 text-neon-cyan/20" />
              <p className="text-slate-300 leading-relaxed flex-1 relative z-10">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
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
