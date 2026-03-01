"use server";

/**
 * Phase 26: Alumni & Career Services server actions.
 * AlumniCareerAgent: Uses LLM_Router + skills graph (PGVector) to generate personalized
 * career recommendations, job matches, outreach messages; auto-links verified credentials;
 * suggests mentorship matches.
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN; LEARNER for own profile only.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessCareer, canManageCareer } from "@/lib/alumni-career-auth";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { prisma } from "@/lib/db";
import { getEmbeddingOrNull } from "@/lib/embeddings";
import { searchCompetenciesByVector } from "@/lib/competency-vector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlumniCareerAgentInput = {
  alumniId?: string;  // Clerk user ID of alumni (uses AlumniProfile)
  studentId?: string; // Clerk user ID of student (uses StudentCompetency + VCs)
};

export type JobMatchItem = {
  opportunityId: string;
  title: string;
  company: string;
  location: string | null;
  type: string;
  matchScore: number;
  reason: string;
};

export type MentorshipSuggestion = {
  alumniId: string;
  name: string;
  currentRole: string | null;
  currentEmployer: string | null;
  graduationYear: number;
  reason: string;
};

export type AlumniCareerAgentResult =
  | {
      ok: true;
      careerRecommendations: string[];
      jobMatches: JobMatchItem[];
      outreachMessage: string;
      suggestedMentors: MentorshipSuggestion[];
      verifiedCredentialsToAttach: { competencyId: string; competencyTitle: string; issuedAt: string }[];
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// AlumniCareerAgent
// ---------------------------------------------------------------------------

/**
 * AlumniCareerAgent: Generates personalized career recommendations, job matches from
 * skills graph (PGVector), outreach message, and mentorship suggestions.
 * Auto-links verified credentials for job applications.
 */
export async function runAlumniCareerAgent(
  input: AlumniCareerAgentInput
): Promise<AlumniCareerAgentResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  const targetId = input.alumniId ?? input.studentId ?? userId;
  if (!targetId) {
    return { ok: false, error: "Provide alumniId or studentId, or ensure you are signed in." };
  }

  // Permission: own profile ok for anyone with career access; others require canManageCareer
  const isSelf = targetId === userId;
  if (!canAccessCareer(role)) {
    return { ok: false, error: "You do not have access to career services." };
  }
  if (!isSelf && !canManageCareer(role)) {
    return { ok: false, error: "You can only run the career agent for yourself." };
  }

  // Build profile context and fetch verified credentials (for students)
  let profileSummary: string;
  let skillsTextForEmbedding: string;
  const verifiedCredentialsToAttach: { competencyId: string; competencyTitle: string; issuedAt: string }[] = [];

  if (input.alumniId) {
    const alumni = await prisma.alumniProfile.findFirst({
      where: { tenantId, user: { clerkUserId: input.alumniId } },
      include: { user: true },
    });
    if (!alumni) {
      return { ok: false, error: "Alumni profile not found." };
    }
    profileSummary = [
      `Alumni: ${alumni.user.firstName ?? ""} ${alumni.user.lastName ?? ""}`,
      `Graduation year: ${alumni.graduationYear}`,
      `Degree: ${alumni.degree}`,
      `Current role: ${alumni.currentRole ?? "Not specified"}`,
      `Current employer: ${alumni.currentEmployer ?? "Not specified"}`,
      alumni.linkedinUrl ? `LinkedIn: ${alumni.linkedinUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    skillsTextForEmbedding = [alumni.degree, alumni.currentRole, alumni.currentEmployer].filter(Boolean).join(" ");
  } else {
    // Student: use StudentCompetency + VerifiableCredential (targetId = input.studentId ?? current user)
    const [competencies, vcs, enrollments] = await Promise.all([
      prisma.studentCompetency.findMany({
        where: { tenantId, studentId: targetId },
        include: { competency: { include: { programme: true } } },
        orderBy: { masteryLevel: "desc" },
        take: 30,
      }),
      prisma.verifiableCredential.findMany({
        where: { tenantId, studentId: targetId, status: "ISSUED" },
        include: { competency: true },
        orderBy: { issuedAt: "desc" },
      }),
      prisma.programmeEnrollment.findMany({
        where: { studentId: targetId },
        include: { programme: true },
      }),
    ]);
    const compSummary = competencies
      .map((c) => `${c.competency.title} (${c.competency.code}) mastery ${(c.masteryLevel * 100).toFixed(0)}%`)
      .join("; ");
    const programmeNames = enrollments.map((e) => e.programme.name).join(", ");
    profileSummary = [
      "Student profile",
      `Programmes: ${programmeNames || "None"}`,
      `Competencies / skills: ${compSummary || "None"}`,
    ].join("\n");
    skillsTextForEmbedding = compSummary || programmeNames;
    vcs.forEach((vc) => {
      verifiedCredentialsToAttach.push({
        competencyId: vc.competencyId,
        competencyTitle: vc.competency.title,
        issuedAt: vc.issuedAt.toISOString(),
      });
    });
  }

  // Open job opportunities (not expired)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const opportunities = await prisma.careerOpportunity.findMany({
    where: { tenantId, expiresAt: { gte: today } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Use skills graph (PGVector): for student, get similarity between job descriptions and student competencies
  let jobScores: { id: string; score: number }[] = [];
  if (!input.alumniId && skillsTextForEmbedding) {
    const embedding = await getEmbeddingOrNull(
      opportunities.map((o) => `${o.title} ${o.company} ${o.description ?? ""}`).join(" ") || "job"
    );
    if (embedding) {
      const similar = await searchCompetenciesByVector(
        tenantId,
        embedding,
        10,
        0,
        targetId
      );
      const compIds = new Set(similar.map((s) => s.competencyId));
      opportunities.forEach((o) => {
        const jobText = `${o.title} ${o.company}`;
        const match = similar.find((s) => s.similarity > 0.3);
        jobScores.push({
          id: o.id,
          score: match ? match.similarity : 0.2,
        });
      });
    }
  }
  if (jobScores.length === 0) {
    opportunities.forEach((o) => jobScores.push({ id: o.id, score: 0.5 }));
  }

  // Suggested mentors: alumni with profiles (exclude self), optionally by degree/industry
  const mentors = await prisma.alumniProfile.findMany({
    where: {
      tenantId,
      user: { clerkUserId: { not: targetId } },
    },
    include: { user: true },
    take: 10,
  });

  const mentorSuggestions: MentorshipSuggestion[] = mentors.slice(0, 5).map((m) => ({
    alumniId: m.user.clerkUserId,
    name: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "Alumni",
    currentRole: m.currentRole,
    currentEmployer: m.currentEmployer,
    graduationYear: m.graduationYear,
    reason: `Alumni in ${m.currentEmployer ?? "industry"}; ${m.degree}.`,
  }));

  const systemPrompt = `You are an AI Career Coach for a university. Given a profile summary (alumni or student), a list of open job opportunities with optional match scores, and suggested mentors, output a JSON object (no markdown, no code fence) with:
{
  "careerRecommendations": ["3-5 short, actionable career recommendations based on their skills and goals"],
  "jobMatches": [{"opportunityId": "<id>", "reason": "one sentence why this job fits"} for top 3-5 jobs; use the provided opportunity ids],
  "outreachMessage": "A short, professional 2-4 sentence message the candidate can use when applying or reaching out to recruiters. Mention key strengths and interest."
}
Consider skills graph data, degree, experience. Be concise and professional. Output only the JSON object.`;

  const jobsForLlm = opportunities.slice(0, 15).map((o) => ({
    id: o.id,
    title: o.title,
    company: o.company,
    location: o.location,
    type: o.type,
    score: jobScores.find((s) => s.id === o.id)?.score ?? 0.5,
  }));

  const userPrompt = `Profile:\n${profileSummary}\n\nOpen opportunities (with match score 0-1):\n${JSON.stringify(jobsForLlm)}\n\nSuggested mentors (for context): ${mentorSuggestions.length} alumni.\n\nGenerate career recommendations, top job matches with reasons, and an outreach message.`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "alumni-career",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const trimmed = result.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: {
    careerRecommendations: string[];
    jobMatches: { opportunityId: string; reason: string }[];
    outreachMessage: string;
  };
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    parsed = {
      careerRecommendations: Array.isArray(raw.careerRecommendations) ? (raw.careerRecommendations as string[]) : [],
      jobMatches: Array.isArray(raw.jobMatches) ? (raw.jobMatches as { opportunityId: string; reason: string }[]) : [],
      outreachMessage: typeof raw.outreachMessage === "string" ? raw.outreachMessage : "",
    };
  } catch {
    return { ok: false, error: "Failed to parse AI response." };
  }

  const opportunityMap = new Map(opportunities.map((o) => [o.id, o]));
  const jobMatches: JobMatchItem[] = parsed.jobMatches
    .filter((m) => opportunityMap.has(m.opportunityId))
    .map((m) => {
      const o = opportunityMap.get(m.opportunityId)!;
      const score = jobScores.find((s) => s.id === o.id)?.score ?? 0.5;
      return {
        opportunityId: o.id,
        title: o.title,
        company: o.company,
        location: o.location,
        type: o.type,
        matchScore: Math.round(score * 100) / 100,
        reason: m.reason,
      };
    });

  return {
    ok: true,
    careerRecommendations: parsed.careerRecommendations,
    jobMatches,
    outreachMessage: parsed.outreachMessage,
    suggestedMentors: mentorSuggestions,
    verifiedCredentialsToAttach,
  };
}
