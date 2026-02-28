/**
 * Types for StudentSuccessAgent: holistic nudges, wellness, and equity-aware adaptations.
 */

export interface StudentSuccessContext {
  /** 0–100 overall or current module progress */
  progressPercent?: number;
  /** Recent activity summary (e.g. "Completed 2 modules this week") */
  recentActivitySummary?: string;
  /** Current course/module title if in context */
  currentFocus?: string;
  /** Optional: time of day / timezone hint for culturally appropriate greetings */
  timeOfDay?: "morning" | "afternoon" | "evening";
}

export interface StudentSuccessInput {
  studentId: string;
  tenantId: string;
  context: StudentSuccessContext;
}

export type WellnessNudgeType =
  | "WELLNESS_CHECKIN"
  | "MOTIVATION"
  | "TIME_MANAGEMENT"
  | "STRESS_RELIEF"
  | "EQUITY_SUPPORT"
  | "OTHER";

export interface StudentSuccessNudge {
  nudgeType: WellnessNudgeType;
  /** Privacy-first, culturally sensitive message to show the student */
  message: string;
  /** Optional suggested adaptations based on equity metrics (e.g. "Consider shorter focus blocks") */
  suggestedAdaptations?: string[];
  /** Optional CTA label (e.g. "Log how I feel") */
  ctaLabel?: string;
}

export interface StudentSuccessResult {
  ok: true;
  nudge: StudentSuccessNudge;
  /** Id of the WellnessLog entry created */
  wellnessLogId: string;
}

export interface StudentSuccessError {
  ok: false;
  error: string;
}

export type StudentSuccessOutput = StudentSuccessResult | StudentSuccessError;
