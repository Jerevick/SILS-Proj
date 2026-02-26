"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 via-transparent to-neon-purple/5" />
      <div className="absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-cyan/10 blur-[120px]" />
      <div className="absolute right-0 top-1/4 h-[300px] w-[400px] rounded-full bg-neon-purple/10 blur-[100px]" />
      <div className="absolute bottom-1/4 left-0 h-[200px] w-[300px] rounded-full bg-neon-purple/5 blur-[80px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 max-w-5xl"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-mono text-sm uppercase tracking-[0.3em] text-neon-cyan mb-6"
        >
          AI-Native Learning & Information System
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl"
        >
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            One platform.
          </span>
          <br />
          <span className="bg-gradient-to-r from-neon-cyan via-neon-cyanDim to-neon-purple bg-clip-text text-transparent">
            Every student.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mx-auto mt-8 max-w-2xl text-lg text-slate-400"
        >
          SILS unifies learning management and student information in a single
          AI-powered system. Start with LMS-only, add SIS when you&apos;re ready—or
          run a fully unified campus from day one.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#request-demo"
            className="rounded-xl bg-neon-cyan px-8 py-4 text-base font-semibold text-space-950 shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:shadow-[0_0_40px_rgba(0,245,255,0.5)] transition-shadow"
          >
            Request Demo
          </a>
          <a
            href="#modes"
            className="rounded-xl glass px-8 py-4 text-base font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/30 hover:text-neon-cyan transition-colors"
          >
            See how it works
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-slate-500">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-8 w-5 rounded-full border-2 border-slate-500 flex items-start justify-center p-1.5"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-neon-cyan" />
        </motion.div>
      </motion.div>
    </section>
  );
}
