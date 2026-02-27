"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ONBOARDING_DEPLOYMENT_MODES,
  onboardingRequestSchema,
  type OnboardingRequestInput,
} from "@/lib/onboarding-schema";

type Step = "mode" | "details";

async function submitOnboardingRequest(data: OnboardingRequestInput) {
  const res = await fetch("/api/onboarding/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to submit request");
  }
  return res.json();
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("mode");
  const [formData, setFormData] = useState<Partial<OnboardingRequestInput>>({
    deploymentMode: undefined,
    institutionName: "",
    slug: "",
    contactPerson: "",
    contactEmail: "",
    phone: "",
    country: "",
    website: "",
    approxStudents: undefined,
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitOnboardingRequest,
    onSuccess: () => setSubmitSuccess(true),
    onError: () => setValidationError(null),
  });

  const handleModeSelect = (mode: OnboardingRequestInput["deploymentMode"]) => {
    setFormData((prev) => ({ ...prev, deploymentMode: mode }));
    setStep("details");
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const raw = {
      ...formData,
      slug: (formData.slug ?? "").toLowerCase().trim(),
      approxStudents:
        (formData.approxStudents as string | number | null | undefined) === "" ||
        formData.approxStudents == null
          ? undefined
          : Number(formData.approxStudents),
    };
    const parsed = onboardingRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const msg = (Object.values(flat).flat().filter(Boolean)[0] as string) || "Please fix the form.";
      setValidationError(msg);
      return;
    }
    mutation.mutate(parsed.data);
  };

  const slugFromName = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-space-950 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg text-center glass-strong rounded-2xl border border-neon-cyan/25 p-10"
        >
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            Request submitted
          </h1>
          <p className="text-slate-400 mb-6">
            Your institution onboarding request has been received. We will review
            it and send a welcome email to the contact address once approved.
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-neon-cyan/20 px-5 py-2.5 text-sm font-semibold text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            Back to home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950 pt-24 pb-16 px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-neon-cyan mb-8 inline-block"
        >
          ← Back to SILS
        </Link>
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          Institution onboarding
        </h1>
        <p className="text-slate-400 mb-10">
          Request access for your institution. Choose a deployment mode and fill
          in your details.
        </p>

        <AnimatePresence mode="wait">
          {step === "mode" && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="space-y-6"
            >
              <p className="text-slate-300 font-medium">1. Select deployment mode</p>
              <div className="grid gap-4">
                {ONBOARDING_DEPLOYMENT_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => handleModeSelect(mode.value)}
                    className={`text-left rounded-xl p-5 border transition-all ${
                      formData.deploymentMode === mode.value
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="font-semibold text-white block">
                      {mode.label}
                    </span>
                    <span className="text-sm text-slate-400">
                      {mode.description}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "details" && (
            <motion.form
              key="details"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              onSubmit={handleDetailsSubmit}
              className="space-y-6 glass-strong rounded-2xl border border-white/10 p-8"
            >
              <p className="text-slate-300 font-medium">
                2. Institution details
              </p>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Institution name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.institutionName ?? ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        institutionName: name,
                        slug: prev.slug || slugFromName(name),
                      }));
                    }}
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                    placeholder="Acme University"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Institution identifier (slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      }))
                    }
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                    placeholder="acme-university"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Used in your dashboard URL, e.g. https://acme-university.sils.app
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Contact person *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          contactPerson: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Contact email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          contactEmail: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                      placeholder="jane@acme.edu"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Country *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.country ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, country: e.target.value }))
                      }
                      className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                      placeholder="United States"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, website: e.target.value }))
                    }
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                    placeholder="https://www.acme.edu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Approx. number of students
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.approxStudents ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        approxStudents: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                    placeholder="5000"
                  />
                </div>
              </div>
              {mutation.error && (
                <p className="text-sm text-red-400">{String(mutation.error.message)}</p>
              )}
              {validationError && (
                <p className="text-sm text-red-400">{validationError}</p>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("mode")}
                  className="rounded-lg glass px-5 py-2.5 text-sm font-semibold text-slate-200 border border-white/10 hover:border-neon-cyan/40 hover:text-neon-cyan transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-lg bg-neon-cyan px-5 py-2.5 text-sm font-semibold text-space-950 hover:bg-neon-cyan/90 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
