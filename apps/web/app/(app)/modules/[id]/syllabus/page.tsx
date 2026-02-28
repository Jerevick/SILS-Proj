"use client";

/**
 * Module syllabus page: lecturer uploads/pastes syllabus → "Auto-Build with AI" →
 * review generated content (outline, outcomes, assignments, rubrics, tests) → publish.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { ProgrammeModuleDetail } from "@/app/api/programme-modules/[id]/route";

const MODULE_QUERY_KEY = ["programme-module"] as const;

async function fetchModule(id: string): Promise<ProgrammeModuleDetail> {
  const res = await fetch(`/api/programme-modules/${id}`);
  if (!res.ok) throw new Error("Failed to fetch module");
  return res.json();
}

async function runAutobuild(
  moduleId: string,
  syllabusText?: string
): Promise<{ moduleId: string; status: string; message: string }> {
  const res = await fetch(`/api/programme-modules/${moduleId}/syllabus/autobuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(syllabusText != null ? { syllabusText } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Auto-build failed");
  return data;
}

async function patchModule(
  moduleId: string,
  data: { syllabusText?: string | null; syllabusStatus?: string }
): Promise<void> {
  const res = await fetch(`/api/programme-modules/${moduleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update module");
}

type GeneratedContent = {
  contentOutline?: { title: string; summary: string; order: number }[];
  learningOutcomes?: { id: string; text: string; alignedToProgramme?: string }[];
  assignments?: {
    title: string;
    type: string;
    description?: string;
    rubric?: { criteria: { name: string; points: number; description?: string }[] };
  }[];
  tests?: { title: string; type: string; itemCount?: number }[];
  adaptivePathways?: { condition: string; path: string }[];
};

export default function ModuleSyllabusPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: moduleRecord, isLoading, error } = useQuery({
    queryKey: [...MODULE_QUERY_KEY, id],
    queryFn: () => fetchModule(id),
    enabled: !!id,
  });

  const [syllabusText, setSyllabusText] = useState("");
  const [autobuildError, setAutobuildError] = useState<string | null>(null);

  const autobuildMutation = useMutation({
    mutationFn: (text?: string) => runAutobuild(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...MODULE_QUERY_KEY, id] });
      setAutobuildError(null);
    },
    onError: (e: Error) => {
      setAutobuildError(e.message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => patchModule(id, { syllabusStatus: "PUBLISHED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...MODULE_QUERY_KEY, id] });
    },
  });

  const syncSyllabusMutation = useMutation({
    mutationFn: () =>
      patchModule(id, {
        syllabusText: syllabusText || moduleRecord?.syllabusText || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...MODULE_QUERY_KEY, id] });
    },
  });

  const currentText = syllabusText || moduleRecord?.syllabusText || "";
  const generated = (moduleRecord?.syllabusGeneratedJson ?? {}) as GeneratedContent;
  const hasGenerated =
    (generated.contentOutline?.length ?? 0) > 0 ||
    (generated.learningOutcomes?.length ?? 0) > 0;

  if (isLoading || !moduleRecord) {
    return (
      <div className="text-slate-400">Loading module…</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/programmes" className="text-neon-cyan hover:underline text-sm">
          ← Back to programmes
        </Link>
        <p className="text-amber-400">Module not found or failed to load.</p>
      </div>
    );
  }

  const handleAutobuild = () => {
    const text = syllabusText.trim() || moduleRecord.syllabusText?.trim();
    if (!text) {
      setAutobuildError("Enter or paste syllabus text first.");
      return;
    }
    if (syllabusText.trim()) {
      syncSyllabusMutation.mutate(undefined, {
        onSuccess: () => autobuildMutation.mutate(syllabusText.trim()),
      });
    } else {
      autobuildMutation.mutate(text);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/programmes/${moduleRecord.programmeId}/curriculum`}
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to curriculum
        </Link>
        <h1 className="font-display text-2xl font-bold text-white">
          {moduleRecord.title}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {moduleRecord.programme.name} ({moduleRecord.programme.code}) · {moduleRecord.credits} credits · Status: {moduleRecord.syllabusStatus}
        </p>
      </div>

      <div className="glass rounded-xl border border-white/5 p-4">
        <h2 className="font-display text-lg font-semibold text-white mb-3">
          Syllabus (upload or paste)
        </h2>
        <p className="text-slate-400 text-sm mb-3">
          Paste syllabus text below. Then click &quot;Auto-Build with AI&quot; to generate content outline, learning outcomes, assignments with rubrics, and tests. PDF: copy text from your PDF and paste here.
        </p>
        <textarea
          className="w-full min-h-[180px] rounded-lg bg-space-900 border border-white/10 text-slate-200 text-sm p-3"
          placeholder="Paste syllabus text or paste extracted text from a PDF…"
          value={syllabusText || moduleRecord.syllabusText || ""}
          onChange={(e) => setSyllabusText(e.target.value)}
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-3 mt-3">
          <button
            type="button"
            onClick={handleAutobuild}
            disabled={autobuildMutation.isPending || !currentText.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {autobuildMutation.isPending ? "Building…" : "Auto-Build with AI"}
          </button>
          {currentText && (
            <button
              type="button"
              onClick={() => syncSyllabusMutation.mutate()}
              disabled={syncSyllabusMutation.isPending}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 border border-white/20 hover:bg-white/15 disabled:opacity-50"
            >
              {syncSyllabusMutation.isPending ? "Saving…" : "Save syllabus text"}
            </button>
          )}
        </div>
        {autobuildError && (
          <p className="text-amber-400 text-sm mt-2">{autobuildError}</p>
        )}
      </div>

      {hasGenerated && (
        <>
          <div className="glass rounded-xl border border-white/5 p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-3">
              Generated content (review before publishing)
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              AI-generated content. Edit programme curriculum if you need to change programme outcomes. When ready, click Publish.
            </p>

            {generated.contentOutline && generated.contentOutline.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Content outline</h3>
                <ul className="space-y-2">
                  {generated.contentOutline
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((item, i) => (
                      <li key={i} className="rounded-lg bg-white/5 p-3 border border-white/5">
                        <span className="font-medium text-white">{item.title}</span>
                        {item.summary && (
                          <p className="text-slate-400 text-sm mt-1">{item.summary}</p>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {generated.learningOutcomes && generated.learningOutcomes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Learning outcomes</h3>
                <ul className="space-y-1">
                  {generated.learningOutcomes.map((lo, i) => (
                    <li key={i} className="text-slate-200 text-sm">
                      <span className="text-slate-500 font-mono">{lo.id}:</span> {lo.text}
                      {lo.alignedToProgramme && (
                        <span className="text-slate-500 text-xs ml-2">
                          (aligns to programme)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generated.assignments && generated.assignments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Assignments &amp; rubrics</h3>
                <ul className="space-y-3">
                  {generated.assignments.map((a, i) => (
                    <li key={i} className="rounded-lg bg-white/5 p-3 border border-white/5">
                      <span className="font-medium text-white">{a.title}</span>
                      <span className="text-slate-500 text-sm ml-2">({a.type})</span>
                      {a.description && (
                        <p className="text-slate-400 text-sm mt-1">{a.description}</p>
                      )}
                      {a.rubric?.criteria && a.rubric.criteria.length > 0 && (
                        <ul className="mt-2 text-sm text-slate-400">
                          {a.rubric.criteria.map((c, j) => (
                            <li key={j}>
                              {c.name}: {c.points} pts
                              {c.description && ` — ${c.description}`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generated.tests && generated.tests.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Tests</h3>
                <ul className="space-y-1">
                  {generated.tests.map((t, i) => (
                    <li key={i} className="text-slate-200 text-sm">
                      {t.title} ({t.type}
                      {t.itemCount != null ? `, ${t.itemCount} items` : ""})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generated.adaptivePathways && generated.adaptivePathways.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Adaptive pathways</h3>
                <ul className="space-y-2">
                  {generated.adaptivePathways.map((p, i) => (
                    <li key={i} className="text-slate-400 text-sm">
                      <span className="text-slate-500">If:</span> {p.condition} → {p.path}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {moduleRecord.syllabusStatus === "PENDING_REVIEW" && (
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
              >
                {publishMutation.isPending ? "Publishing…" : "Publish syllabus"}
              </button>
            )}
          </div>
        </>
      )}

      {!hasGenerated && moduleRecord.syllabusStatus === "DRAFT" && (
        <div className="glass rounded-xl border border-white/5 p-4 text-slate-400 text-sm">
          Add syllabus text above and click &quot;Auto-Build with AI&quot; to generate content for review.
        </div>
      )}
    </div>
  );
}
