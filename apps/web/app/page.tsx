/**
 * SILS — Student Information and Learning System
 * Phase 1: Stunning futuristic marketing landing page
 */
import {
  NeuralBackground,
  Navbar,
  Hero,
  TrustedBy,
  WhySILS,
  ModeToggle,
  AIAtCore,
  FeaturesGrid,
  Testimonials,
  CTA,
} from "./components/landing";

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-space-950">
      <NeuralBackground />
      <Navbar />
      <Hero />
      <TrustedBy />
      <WhySILS />
      <ModeToggle />
      <AIAtCore />
      <FeaturesGrid />
      <Testimonials />
      <CTA />
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-sm font-semibold text-slate-500">
            SILS
          </span>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} SILS. Student Information and Learning
            System.
          </p>
        </div>
      </footer>
    </main>
  );
}
