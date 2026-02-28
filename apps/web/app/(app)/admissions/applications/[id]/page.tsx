"use client";

/**
 * Phase 14: Rich application review interface.
 * Shows current step, review history, AI summary, and Approve / Reject / Request More Info.
 * Integrates with AdmissionsWorkflowEngine and scoped roles (Faculty → Department → Programme).
 */

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  TextField,
  Divider,
  LinearProgress,
} from "@mui/material";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  MessageCircle,
  FileText,
  Clock,
  User,
  GraduationCap,
  Building2,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getApplicationWithWorkflow,
  submitApplicationReview,
  admissionsWorkflowEngine,
} from "@/app/actions/admissions-workflow-engine";
import type { ApplicationReviewStatus } from "@prisma/client";

function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: ["admission-application", id],
    queryFn: async () => {
      if (!id) throw new Error("No application ID");
      const result = await getApplicationWithWorkflow(id);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    enabled: !!id,
  });
}

export default function AdmissionApplicationReviewPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : undefined;

  const { data, isLoading, error } = useApplication(id);

  const submitMutation = useMutation({
    mutationFn: async (input: {
      status: ApplicationReviewStatus;
      comments?: string | null;
    }) => {
      if (!data?.application?.currentWorkflowStepId)
        throw new Error("No current step");
      return submitApplicationReview({
        applicationId: id!,
        stepId: data.application.currentWorkflowStepId,
        status: input.status,
        comments: input.comments ?? null,
      });
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["admission-application", id] });
        toast.success(result.message ?? "Review submitted");
      } else {
        toast.error(result.error);
      }
    },
    onError: (err) =>
      toast.error("Submit failed", { description: (err as Error).message }),
  });

  const runEngineMutation = useMutation({
    mutationFn: () => admissionsWorkflowEngine(id!),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["admission-application", id] });
        if (result.message) toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    },
    onError: (err) =>
      toast.error("Engine failed", { description: (err as Error).message }),
  });

  const [comments, setComments] = useState("");
  const [actionPending, setActionPending] = useState<
    ApplicationReviewStatus | null
  >(null);

  const handleAction = (status: ApplicationReviewStatus) => {
    setActionPending(status);
    submitMutation.mutate(
      { status, comments: comments || undefined },
      {
        onSettled: () => setActionPending(null),
      }
    );
  };

  if (!id) {
    return (
      <DashboardShell>
        <Typography color="error">Missing application ID.</Typography>
        <Button component={Link} href="/admissions/dashboard" sx={{ mt: 2 }}>
          Back to Admissions
        </Button>
      </DashboardShell>
    );
  }

  if (error || (!isLoading && !data)) {
    return (
      <DashboardShell>
        <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <CardContent>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {(error as Error)?.message ?? "Application not found."}
            </Typography>
            <Button
              component={Link}
              href="/admissions/dashboard"
              startIcon={<ArrowLeft className="h-4 w-4" />}
              sx={{ color: "primary.main" }}
            >
              Back to Admissions
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const application = data?.application;
  const workflow = data?.workflow;
  const currentStep = application?.currentWorkflowStep;
  const currentReview = application?.reviews?.find(
    (r) => r.stepId === currentStep?.id
  );
  const steps = workflow?.workflowSteps ?? [];
  const canAct =
    application?.status === "IN_REVIEW" ||
    application?.status === "MORE_INFO_REQUESTED";
  const isPending = currentReview?.status === "PENDING";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            component={Link}
            href="/admissions/dashboard"
            startIcon={<ArrowLeft className="h-4 w-4" />}
            sx={{ color: "rgba(226,232,240,0.8)", textTransform: "none" }}
          >
            Admissions
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan font-display font-bold text-xl">
              {application?.applicantId?.slice(0, 2).toUpperCase() ?? "—"}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                Application {id.slice(0, 8)}…
              </h1>
              <p className="text-sm text-slate-400">
                {application?.programme?.name ?? application?.programmeType}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LinearProgress sx={{ borderRadius: 1 }} />
        ) : (
          <>
            {/* Status and current step */}
            <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <CardHeader
                title="Status"
                subheader={
                  currentStep
                    ? `Current step: ${currentStep.roleName}`
                    : application?.status === "APPROVED"
                      ? "Fully approved"
                      : application?.status === "REJECTED"
                        ? "Rejected"
                        : "No workflow step"
                }
                action={
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip
                      size="small"
                      label={application?.status ?? "—"}
                      color={
                        application?.status === "APPROVED"
                          ? "success"
                          : application?.status === "REJECTED"
                            ? "error"
                            : "default"
                      }
                      variant="outlined"
                      sx={{
                        fontWeight: 600,
                        borderColor:
                          application?.status === "APPROVED"
                            ? "rgba(34,197,94,0.5)"
                            : application?.status === "REJECTED"
                              ? "rgba(239,68,68,0.5)"
                              : "rgba(148,163,184,0.4)",
                      }}
                    />
                    {application?.status === "SUBMITTED" && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => runEngineMutation.mutate()}
                        disabled={runEngineMutation.isPending}
                        sx={{ textTransform: "none" }}
                      >
                        Start workflow
                      </Button>
                    )}
                  </Box>
                }
              />
              {/* Step progress */}
              {steps.length > 0 && (
                <CardContent sx={{ pt: 0 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                    {steps.map((s, i) => {
                      const review = application?.reviews?.find(
                        (r) => r.stepId === s.id
                      );
                      const isCurrent = s.id === currentStep?.id;
                      return (
                        <Box
                          key={s.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Chip
                            size="small"
                            label={s.roleName}
                            variant={isCurrent ? "filled" : "outlined"}
                            color={
                              review?.status === "APPROVED"
                                ? "success"
                                : review?.status === "REJECTED"
                                  ? "error"
                                  : isCurrent
                                    ? "primary"
                                    : "default"
                            }
                            sx={{
                              fontWeight: 600,
                              borderColor: isCurrent ? "primary.main" : "rgba(148,163,184,0.4)",
                            }}
                          />
                          {i < steps.length - 1 && (
                            <Typography color="text.secondary">→</Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              )}
            </Card>

            {/* AI summary */}
            {currentReview?.aiSummary && (
              <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <CardHeader
                  avatar={<Sparkles className="h-5 w-5 text-amber-400" />}
                  title="AI summary"
                  subheader="Prior learning / fit (generated at this step)"
                />
                <CardContent sx={{ pt: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226,232,240,0.9)", whiteSpace: "pre-wrap" }}
                  >
                    {currentReview.aiSummary}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Review history */}
            <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <CardHeader title="Review history" />
              <CardContent sx={{ pt: 0 }}>
                {!application?.reviews?.length ? (
                  <Typography color="text.secondary">No reviews yet.</Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {[...(application.reviews ?? [])]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((r) => (
                        <Box
                          component="li"
                          key={r.id}
                          sx={{ mb: 1.5, color: "rgba(226,232,240,0.9)" }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {r.step?.roleName ?? "Step"} — {r.status}
                          </Typography>
                          {r.comments && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {r.comments}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {new Date(r.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      ))}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Actions: Approve / Reject / Request More Info */}
            {canAct && currentStep && isPending && (
              <Card sx={{ bgcolor: "rgba(15,15,35,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <CardHeader title="Your decision" subheader={`Step: ${currentStep.roleName}`} />
                <CardContent sx={{ pt: 0 }}>
                  <TextField
                    fullWidth
                    label="Comments (optional)"
                    placeholder="Add notes for the applicant or next reviewer…"
                    multiline
                    rows={3}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    sx={{
                      mb: 2,
                      "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                      "& .MuiInputLabel-root": { color: "rgba(148,163,184,0.8)" },
                    }}
                  />
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircle className="h-4 w-4" />}
                      onClick={() => handleAction("APPROVED")}
                      disabled={
                        submitMutation.isPending ||
                        actionPending !== null
                      }
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<XCircle className="h-4 w-4" />}
                      onClick={() => handleAction("REJECTED")}
                      disabled={
                        submitMutation.isPending ||
                        actionPending !== null
                      }
                      sx={{ textTransform: "none", fontWeight: 600 }}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<MessageCircle className="h-4 w-4" />}
                      onClick={() => handleAction("MORE_INFO_REQUESTED")}
                      disabled={
                        submitMutation.isPending ||
                        actionPending !== null
                      }
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderColor: "rgba(148,163,184,0.5)",
                        color: "rgba(226,232,240,0.9)",
                      }}
                    >
                      Request more info
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
