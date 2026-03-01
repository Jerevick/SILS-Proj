"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  BarChart3,
  Users,
  GraduationCap,
  Building2,
  Plug,
} from "lucide-react";

const features = [
  {
    title: "Courses & content",
    desc: "Rich content authoring, modules, and sequencing. SCORM and LTI support.",
    icon: BookOpen,
  },
  {
    title: "Grades & analytics",
    desc: "Gradebooks, rubrics, and dashboards. Export to SIS or keep everything in SILS.",
    icon: BarChart3,
  },
  {
    title: "Rosters & SSO",
    desc: "Roster sync, single sign-on (SAML/OIDC), and role-based access.",
    icon: Users,
  },
  {
    title: "Academic records",
    desc: "Transcripts, degree audit, and compliance reporting—when you run unified SIS.",
    icon: GraduationCap,
  },
  {
    title: "Multi-tenant",
    desc: "Isolated institutions, shared infra. White-label and custom branding.",
    icon: Building2,
  },
  {
    title: "API-first",
    desc: "REST and webhooks. Integrate with CRMs, LRS, and your ecosystem.",
    icon: Plug,
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="relative z-10 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl">
            Everything you need
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-slate-400">
            From courses to credentials—one platform. Beyond Canvas, Blackboard, and Ellucian.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group glass-card rounded-2xl p-6 border border-white/5 hover:border-neon-purple/25 hover:shadow-[0_0_30px_rgba(168,85,247,0.08)] transition-all duration-300"
              >
                <div className="inline-flex p-2.5 rounded-xl bg-neon-purple/10 border border-neon-purple/20 text-neon-purple mb-4 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.2)] transition-shadow">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
