/**
 * Phase 12: Types for AI grading agent.
 * Per-criterion feedback, overall grade, confidence score, suggested comments.
 */

export type RubricCriterion = {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
};

export type AIGradingCriterionResult = {
  criterionId: string;
  points: number;
  maxPoints: number;
  feedback: string;
};

export type AIGradingResult = {
  criteria: AIGradingCriterionResult[];
  overallGrade: string; // e.g. "85", "A", "42/50"
  overallFeedback: string;
  confidenceScore: number; // 0–1
  suggestedComments: string[]; // Ready-to-use comment snippets for lecturer
};

export type AIGradingAgentInput = {
  submissionId: string;
  rubricId: string;
  tenantId: string;
};

export type AIGradingAgentOutput =
  | { ok: true; result: AIGradingResult }
  | { ok: false; error: string };
