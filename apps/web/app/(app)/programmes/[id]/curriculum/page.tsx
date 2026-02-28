"use client";

/**
 * Curriculum editor for a programme: edit curriculum JSON and list/add modules.
 * Hybrid/SIS only (programme structure).
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { ProgrammeWithModules } from "@/app/api/programmes/[id]/route";
import { PROGRAMMES_QUERY_KEY } from "@/lib/query-keys";

const PROGRAMME_QUERY_KEY = ["programme"] as const;

async function fetchProgramme(id: string): Promise<ProgrammeWithModules> {
  const res = await fetch(`/api/programmes/${id}`);
  if (!res.ok) throw new Error("Failed to fetch programme");
  return res.json();
}

async function patchCurriculum(
  id: string,
  curriculumJson: unknown
): Promise<{ curriculumJson: unknown }> {
  const res = await fetch(`/api/programmes/${id}/curriculum`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ curriculumJson }),
  });
  if (!res.ok) throw new Error("Failed to update curriculum");
  return res.json();
}

async function addModule(programmeId: string, title: string): Promise<{ id: string; title: string }> {
  const res = await fetch(`/api/programmes/${programmeId}/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to add module");
  return res.json();
}

const DEFAULT_CURRICULUM_JSON = {
  learningOutcomes: [] as { text: string }[],
  overview: "",
};

export default function ProgrammeCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: programme, isLoading, error } = useQuery({
    queryKey: [...PROGRAMME_QUERY_KEY, id],
    queryFn: () => fetchProgramme(id),
    enabled: !!id,
  });

  const [curriculumText, setCurriculumText] = useState("");
  const [curriculumDirty, setCurriculumDirty] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!programme?.curriculumJson) {
      setCurriculumText(JSON.stringify(DEFAULT_CURRICULUM_JSON, null, 2));
      return;
    }
    setCurriculumText(JSON.stringify(programme.curriculumJson, null, 2));
  }, [programme?.id]);

  const patchMutation = useMutation({
    mutationFn: (curriculumJson: unknown) => patchCurriculum(id, curriculumJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PROGRAMME_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ["programmes"] });
      setCurriculumDirty(false);
    },
  });

  const addModuleMutation = useMutation({
    mutationFn: (title: string) => addModule(id, title),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...PROGRAMME_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ["programmes"] });
      setNewModuleTitle("");
      setAddError(null);
      router.push(`/modules/${data.id}/syllabus`);
    },
    onError: (e: Error) => {
      setAddError(e.message);
    },
  });

  if (isLoading || !programme) {
    return (
      <div className="text-slate-400">
        Loading programme…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/programmes" className="text-neon-cyan hover:underline text-sm">
          ← Back to programmes
        </Link>
        <p className="text-amber-400">Programme not found or failed to load.</p>
      </div>
    );
  }

  const handleSaveCurriculum = () => {
    try {
      const parsed = JSON.parse(curriculumText);
      patchMutation.mutate(parsed);
    } catch {
      setAddError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/programmes"
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to programmes
        </Link>
        <h1 className="font-display text-2xl font-bold text-white">
          {programme.name}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {programme.department.faculty.name} → {programme.department.name} · {programme.code} · {programme.credits} credits
        </p>
      </div>

      <div className="glass rounded-xl border border-white/5 p-4">
        <h2 className="font-display text-lg font-semibold text-white mb-3">
          Curriculum (JSON)
        </h2>
        <p className="text-slate-400 text-sm mb-3">
          Edit learning outcomes and overview. Use <code className="bg-white/10 px-1 rounded">learningOutcomes</code> array for programme-level outcomes that modules can align to.
        </p>
        <textarea
          className="w-full min-h-[200px] rounded-lg bg-space-900 border border-white/10 text-slate-200 font-mono text-sm p-3"
          value={curriculumText}
          onChange={(e) => {
            setCurriculumText(e.target.value);
            setCurriculumDirty(true);
          }}
          spellCheck={false}
        />
        {curriculumDirty && (
          <button
            type="button"
            onClick={handleSaveCurriculum}
            disabled={patchMutation.isPending}
            className="mt-3 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
          >
            {patchMutation.isPending ? "Saving…" : "Save curriculum"}
          </button>
        )}
      </div>

      <div className="glass rounded-xl border border-white/5 p-4">
        <h2 className="font-display text-lg font-semibold text-white mb-3">
          Modules ({programme.modules.length})
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="New module title"
            className="rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm min-w-[200px]"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (newModuleTitle.trim()) addModuleMutation.mutate(newModuleTitle.trim());
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (newModuleTitle.trim()) addModuleMutation.mutate(newModuleTitle.trim());
            }}
            disabled={!newModuleTitle.trim() || addModuleMutation.isPending}
            className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
          >
            {addModuleMutation.isPending ? "Adding…" : "Add module"}
          </button>
        </div>
        {addError && (
          <p className="text-amber-400 text-sm mb-2">{addError}</p>
        )}
        <ul className="space-y-2">
          {programme.modules.length === 0 ? (
            <li className="text-slate-500 text-sm">No modules yet. Add one above.</li>
          ) : (
            programme.modules.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-4 rounded-lg border border-white/5 p-3 bg-white/5"
              >
                <span className="text-slate-500 font-mono text-sm w-8">{m.order + 1}.</span>
                <Link
                  href={`/modules/${m.id}/syllabus`}
                  className="text-neon-cyan hover:underline font-medium flex-1"
                >
                  {m.title}
                </Link>
                <span className="text-slate-500 text-sm">
                  {m.credits} cr · {m.syllabusStatus}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
