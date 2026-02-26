"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "Courses & content",
    desc: "Rich content authoring, modules, and sequencing. SCORM and LTI support.",
  },
  {
    title: "Grades & analytics",
    desc: "Gradebooks, rubrics, and dashboards. Export to SIS or keep everything in SILS.",
  },
  {
    title: "Rosters & SSO",
    desc: "Roster sync, single sign-on (SAML/OIDC), and role-based access.",
  },
  {
    title: "Academic records",
    desc: "Transcripts, degree audit, and compliance reporting—when you run unified SIS.",
  },
  {
    title: "Multi-tenant",
    desc: "Isolated institutions, shared infra. White-label and custom branding.",
  },
  {
    title: "API-first",
    desc: "REST and webhooks. Integrate with CRMs, LRS, and your ecosystem.",
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
            From courses to credentials—one platform, one contract, one roadmap.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-6 border border-white/5 hover:border-neon-purple/20 transition-colors"
            >
              <h3 className="font-display text-lg font-semibold text-white mb-2">
                {f.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
