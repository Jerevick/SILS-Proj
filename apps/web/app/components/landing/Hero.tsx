"use client";

import { motion } from "framer-motion";
import { Play, Rocket } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5" />
      <div className="absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-cyan/8 blur-[140px] animate-pulse" />
      <div className="absolute right-0 top-1/4 h-[350px] w-[450px] rounded-full bg-neon-purple/10 blur-[120px]" />
      <div className="absolute bottom-1/4 left-0 h-[250px] w-[350px] rounded-full bg-blue-500/5 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-5xl"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-mono text-sm uppercase tracking-[0.35em] text-neon-cyan/90 mb-8"
        >
          AI-Native LMS &amp; Unified SIS
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl leading-[1.05]"
        >
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            The Intelligent Future
          </span>
          <br />
          <span className="bg-gradient-to-r from-neon-cyan via-neon-cyanDim to-neon-purple bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(0,245,255,0.2)]">
            of Higher Education
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed"
        >
          One platform that unifies learning and student information. Start with
          LMS-only, add SIS when you&apos;re ready—or run a fully unified campus
          from day one. Built for AI from the ground up.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#request-demo"
            className="group rounded-xl bg-neon-cyan px-8 py-4 text-base font-semibold text-space-950 shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:shadow-[0_0_50px_rgba(0,245,255,0.5)] transition-all duration-300 flex items-center gap-2"
          >
            <Rocket className="h-5 w-5" />
            Start Free Pilot
          </a>
          <a
            href="#request-demo"
            className="group rounded-xl glass px-8 py-4 text-base font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/40 hover:text-neon-cyan transition-all duration-300 flex items-center gap-2"
          >
            <Play className="h-5 w-5" />
            Watch 2-min Demo
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <span className="text-xs text-slate-500 uppercase tracking-widest">
          Scroll to explore
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="h-10 w-6 rounded-full border-2 border-slate-500/80 flex items-start justify-center pt-2"
        >
          <div className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(0,245,255,0.8)]" />
        </motion.div>
      </motion.div>
    </section>
  );
}
