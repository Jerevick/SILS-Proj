"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Route,
  FileCheck,
  Search,
  TrendingUp,
  Bot,
  Cpu,
  Zap,
  Lock,
  BarChart3,
} from "lucide-react";

const capabilities = [
  { text: "Personalized learning paths", icon: Route },
  { text: "Smart course recommendations", icon: Sparkles },
  { text: "Automated grading & feedback", icon: FileCheck },
  { text: "Natural language search across all content", icon: Search },
  { text: "Predictive analytics & early alerts", icon: TrendingUp },
  { text: "AI teaching assistants", icon: Bot },
];

const demoCards = [
  {
    title: "Request routing",
    snippet: "Tutoring → Claude · Grading → GPT-4 · Search → Embeddings",
    icon: Zap,
    glow: "rgba(0,245,255,0.15)",
  },
  {
    title: "Audit & governance",
    snippet: "Every call logged. Scoped by role, course, and residency.",
    icon: Lock,
    glow: "rgba(168,85,247,0.12)",
  },
  {
    title: "Analytics layer",
    snippet: "Engagement, outcomes, and AI usage—one dashboard.",
    icon: BarChart3,
    glow: "rgba(59,130,246,0.12)",
  },
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
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            AI at the <span className="text-neon-cyan">core</span>
          </h2>
          <p className="mt-5 max-w-2xl mx-auto text-slate-400 text-lg">
            Not a bolt-on. SILS is built for AI from the ground up—so every
            feature can be smarter. Legacy systems like Canvas and Blackboard weren&apos;t designed for this.
          </p>
        </motion.div>

        {/* System Orchestrator hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="rounded-3xl border border-neon-cyan/20 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-purple/10 p-8 lg:p-12 shadow-[0_0_60px_rgba(0,245,255,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-purple/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-shrink-0 p-5 rounded-2xl bg-black/40 border border-neon-cyan/30 shadow-[0_0_30px_rgba(0,245,255,0.15)]">
                <Cpu className="h-14 w-14 text-neon-cyan" />
              </div>
              <div className="flex-1 text-center lg:text-left">
                <h3 className="font-display text-2xl font-bold text-white mb-2">
                  System Orchestrator
                </h3>
                <p className="text-slate-400 leading-relaxed max-w-xl">
                  The brain of SILS. Routes requests to the right models and tools—tutoring,
                  grading, search, analytics—with one API. You control which models run where,
                  with full audit logs and scoped governance.
                </p>
                <p className="mt-4 font-mono text-sm text-neon-cyan/90">
                  One orchestration layer. Every AI capability. Your compliance.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Live-like demo cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
        >
          {demoCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl glass-card border border-white/10 p-5 hover:border-neon-cyan/20 transition-all duration-300 group"
                style={{ boxShadow: `0 0 40px ${card.glow}` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex-shrink-0 p-2 rounded-lg bg-white/5 border border-white/10 text-neon-cyan group-hover:shadow-[0_0_16px_rgba(0,245,255,0.2)] transition-shadow">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-sm font-semibold text-white">{card.title}</span>
                </div>
                <p className="font-mono text-xs text-slate-400 leading-relaxed">{card.snippet}</p>
              </motion.div>
            );
          })}
        </motion.div>

        <p className="text-center text-slate-500 text-sm mb-8 font-medium">
          Capabilities powered by the orchestrator
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-4 rounded-xl glass border border-white/5 px-5 py-4 group hover:border-neon-cyan/25 hover:shadow-[0_0_20px_rgba(0,245,255,0.06)] transition-all"
              >
                <span className="flex-shrink-0 p-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan group-hover:shadow-[0_0_12px_rgba(0,245,255,0.2)] transition-shadow">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-slate-300 font-medium">{item.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
