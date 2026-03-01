/**
 * Phase 22: Types for plagiarism/originality checking.
 * detailed_matches: per-source similarity with excerpts and optional character offsets for highlighting.
 */

export type PlagiarismMatch = {
  source: string; // e.g. "Web source", "Submitted paper (peer)", "Journal article"
  similarityPct: number; // 0–100
  excerpt: string; // Matched text snippet
  startOffset?: number; // Character start in submission content (for highlight)
  endOffset?: number; // Character end in submission content
  sourceUrl?: string; // Optional URL when available
};

export type PlagiarismReportPayload = {
  overallScore: number; // 0–100 similarity percentage
  detailedMatches: PlagiarismMatch[];
};

export type PlagiarismSimilarityInput = {
  contentText: string;
  tenantId: string;
};

export type PlagiarismSimilarityOutput =
  | { ok: true; payload: PlagiarismReportPayload }
  | { ok: false; error: string };
