/**
 * Types for StudentCoachAgent: friction signals and agent output.
 */

import type { FrictionSignalType } from "@prisma/client";

/** Single friction signal from the client (e.g. dwell time, quiz errors). */
export interface FrictionSignalInput {
  signalType: FrictionSignalType;
  /** Optional payload: durationSeconds, errorCount, attempt, context, etc. */
  payload?: Record<string, unknown>;
}

/** Input to StudentCoachAgent. */
export interface StudentCoachInput {
  studentId: string;
  tenantId: string;
  moduleId: string | null;
  courseId: string | null;
  /** 0–100 or similar progress indicator for the module. */
  currentProgress: number;
  /** Recent friction signals (dwell, quiz errors, huddle, etc.). */
  frictionSignals: FrictionSignalInput[];
  /** Optional: module title or context for the LLM. */
  moduleTitle?: string;
}

/** Action the agent decided to take. */
export type CoachActionType =
  | "micro_scaffold"
  | "alternative_explanation"
  | "branching_pathway"
  | "lecturer_intervention"
  | "none";

/** Parsed LLM output for the coach. */
export interface CoachDecision {
  action: CoachActionType;
  /** Content to show the student (scaffold, explanation, pathway hint) or brief for lecturer. */
  content: string;
  /** If true, create an InterventionBrief for the lecturer. */
  createInterventionBrief: boolean;
  /** Short summary for the brief (when createInterventionBrief is true). */
  briefSummary?: string;
  /** Suggested mastery level update (e.g. "struggling" | "on_track" | "mastered"). */
  suggestedMasteryLevel?: string;
  /** Optional skill IDs or names to attach to state. */
  skillsUpdated?: string[];
}

export interface StudentCoachResult {
  ok: true;
  decision: CoachDecision;
  /** Whether an intervention brief was created (lecturer notification). */
  interventionBriefCreated: boolean;
  /** Whether a notification was triggered (e.g. in-app or email). */
  notificationTriggered: boolean;
}

export interface StudentCoachError {
  ok: false;
  error: string;
}

export type StudentCoachOutput = StudentCoachResult | StudentCoachError;
