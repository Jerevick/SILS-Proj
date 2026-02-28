"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  ONBOARDING_DEPLOYMENT_MODES,
  ACCREDITATION_STATUS_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  onboardingRequestSchema,
  type OnboardingRequestInput,
} from "@/lib/onboarding-schema";
import { COUNTRY_OPTIONS } from "@/lib/countries";

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
    contactPerson: "",
    contactEmail: "",
    phone: "",
    country: "",
    website: "",
    approxStudents: undefined,
    addressLine1: "",
    addressLine2: "",
    addressCity: "",
    addressStateRegion: "",
    addressPostalCode: "",
    yearFounded: undefined,
    institutionType: "",
    legalEntityName: "",
    taxIdOrRegistrationNumber: "",
    accreditationStatus: undefined,
    accreditationBody: "",
    accreditationCertificateUrl: "",
    missionOrDescription: "",
    numberOfCampuses: undefined,
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitOnboardingRequest,
    onSuccess: () => {
      setSubmitSuccess(true);
      toast.success("Request submitted", {
        description: "We'll review it and send a welcome email to the contact address once approved.",
      });
    },
    onError: (err) => {
      setValidationError(null);
      toast.error("Submission failed", { description: err.message });
    },
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
      approxStudents:
        (formData.approxStudents as string | number | null | undefined) === "" ||
        formData.approxStudents == null
          ? undefined
          : Number(formData.approxStudents),
      yearFounded:
        (formData.yearFounded as string | number | null | undefined) === "" ||
        formData.yearFounded == null
          ? undefined
          : Number(formData.yearFounded),
      numberOfCampuses:
        (formData.numberOfCampuses as string | number | null | undefined) === "" ||
        formData.numberOfCampuses == null
          ? undefined
          : Number(formData.numberOfCampuses),
    };
    const parsed = onboardingRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const msg = (Object.values(flat).flat().filter(Boolean)[0] as string) || "Please fix the form.";
      setValidationError(msg);
      toast.error("Validation error", { description: msg });
      return;
    }
    mutation.mutate(parsed.data);
  };

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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        institutionName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                    placeholder="Acme University"
                  />
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
                    <PhoneInput
                      international
                      defaultCountry="US"
                      value={formData.phone ?? undefined}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, phone: value ?? "" }))
                      }
                      placeholder="Enter phone number"
                      className="phone-input-onboarding"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Select country code and enter a valid number
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Country *
                    </label>
                    <select
                      required
                      value={formData.country ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          country: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white focus:border-neon-cyan/50 focus:outline-none focus:ring-0 appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: "right 0.5rem center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "1.5em 1.5em",
                        paddingRight: "2.5rem",
                      }}
                    >
                      <option value="">Select country</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
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

                <div className="border-t border-white/10 pt-6 mt-2">
                  <p className="text-slate-300 font-medium mb-3">Full address (for due diligence)</p>
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Street address line 1</label>
                      <input
                        type="text"
                        value={formData.addressLine1 ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, addressLine1: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Address line 2</label>
                      <input
                        type="text"
                        value={formData.addressLine2 ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, addressLine2: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
                        <input
                          type="text"
                          value={formData.addressCity ?? ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressCity: e.target.value }))}
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                          placeholder="Boston"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">State / Region</label>
                        <input
                          type="text"
                          value={formData.addressStateRegion ?? ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, addressStateRegion: e.target.value }))}
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                          placeholder="MA"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Postal code</label>
                      <input
                        type="text"
                        value={formData.addressPostalCode ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, addressPostalCode: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none max-w-[140px]"
                        placeholder="02101"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6 mt-2">
                  <p className="text-slate-300 font-medium mb-3">Institution profile & due diligence</p>
                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Year founded</label>
                        <input
                          type="number"
                          min={1000}
                          max={new Date().getFullYear() + 1}
                          value={formData.yearFounded ?? ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              yearFounded: e.target.value === "" ? undefined : Number(e.target.value),
                            }))
                          }
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                          placeholder="1990"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Institution type</label>
                        <select
                          value={formData.institutionType ?? ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, institutionType: e.target.value }))}
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white focus:border-neon-cyan/50 focus:outline-none appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: "right 0.5rem center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "1.5em 1.5em",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select type</option>
                          {INSTITUTION_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Legal entity name (if different from institution name)</label>
                      <input
                        type="text"
                        value={formData.legalEntityName ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, legalEntityName: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                        placeholder="Acme Education Inc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Tax ID or registration number</label>
                      <input
                        type="text"
                        value={formData.taxIdOrRegistrationNumber ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, taxIdOrRegistrationNumber: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Accreditation status</label>
                        <select
                          value={formData.accreditationStatus ?? ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, accreditationStatus: e.target.value as typeof formData.accreditationStatus }))}
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white focus:border-neon-cyan/50 focus:outline-none appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: "right 0.5rem center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "1.5em 1.5em",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select status</option>
                          {ACCREDITATION_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Accrediting body</label>
                        <input
                          type="text"
                          value={formData.accreditationBody ?? ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, accreditationBody: e.target.value }))}
                          className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                          placeholder="e.g. Middle States Commission"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Link to accreditation certificate (optional)</label>
                      <input
                        type="url"
                        value={formData.accreditationCertificateUrl ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, accreditationCertificateUrl: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none"
                        placeholder="https://..."
                      />
                      <p className="text-xs text-slate-500 mt-1">URL to a hosted copy of your accreditation certificate or approval letter</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Number of campuses / locations</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.numberOfCampuses ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            numberOfCampuses: e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none max-w-[120px]"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Brief mission or description (optional)</label>
                      <textarea
                        rows={3}
                        value={formData.missionOrDescription ?? ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, missionOrDescription: e.target.value }))}
                        className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-cyan/50 focus:outline-none resize-none"
                        placeholder="A short description of your institution..."
                      />
                    </div>
                  </div>
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
