"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
  { href: "#for-institutions", label: "For Institutions" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            className="hidden sm:inline-flex text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="#request-demo"
            className="hidden sm:inline-flex rounded-xl bg-neon-cyan/15 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 shadow-[0_0_20px_rgba(0,245,255,0.25)] hover:bg-neon-cyan/25 hover:shadow-[0_0_30px_rgba(0,245,255,0.4)] hover:border-neon-cyan/70 transition-all duration-300 items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Request Demo
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-neon-cyan hover:bg-white/5 transition-colors"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-white/5 glass"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors"
              >
                Sign In
              </Link>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-sm font-medium text-slate-400 hover:text-neon-cyan transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="#request-demo"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-xl bg-neon-cyan/15 px-5 py-3 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Request Demo
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
