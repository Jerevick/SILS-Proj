"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, LogIn } from "lucide-react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
  { href: "#for-institutions", label: "For Institutions" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-display text-xl font-bold tracking-wider text-white group-hover:text-neon-cyan/90 transition-colors">
            SILS
          </span>
          <span className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_10px_rgba(0,245,255,0.9)] animate-pulse" />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors relative after:absolute after:left-0 after:bottom-[-2px] after:h-px after:w-0 after:bg-neon-cyan after:transition-all hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg glass px-4 py-2.5 text-sm font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/40 hover:text-neon-cyan transition-all duration-300 flex items-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-neon-cyan/15 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 shadow-[0_0_20px_rgba(0,245,255,0.25)] hover:bg-neon-cyan/25 hover:shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:border-neon-cyan/70 transition-all duration-300 flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Request Demo
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
