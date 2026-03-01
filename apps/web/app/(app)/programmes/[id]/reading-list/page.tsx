"use client";

/**
 * Phase 23: Programme-specific reading list with "Add from Library" flow.
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Plus, BookMarked } from "lucide-react";
import {
  getProgrammeReadingLists,
  addToReadingList,
  type ReadingListSummary,
} from "@/app/actions/library-actions";
import { programmeReadingListsKey } from "@/lib/query-keys";

async function fetchProgramme(id: string) {
  const res = await fetch(`/api/programmes/${id}`);
  if (!res.ok) throw new Error("Failed to fetch programme");
  return res.json();
}

export default function ProgrammeReadingListPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const programmeId = params.id as string;

  const { data: programme, isLoading: programmeLoading } = useQuery({
    queryKey: ["programme", programmeId],
    queryFn: () => fetchProgramme(programmeId),
    enabled: !!programmeId,
  });

  const { data: listsResult, isLoading: listsLoading } = useQuery({
    queryKey: programmeReadingListsKey(programmeId),
    queryFn: () => getProgrammeReadingLists(programmeId),
    enabled: !!programmeId,
  });

  const addMutation = useMutation({
    mutationFn: (input: {
      readingListName: string;
      resourceId: string;
      moduleId?: string | null;
      required?: boolean;
    }) =>
      addToReadingList({
        programmeId,
        readingListName: input.readingListName,
        resourceId: input.resourceId,
        moduleId: input.moduleId ?? null,
        required: input.required ?? false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programmeReadingListsKey(programmeId) });
    },
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [resourceIdToAdd, setResourceIdToAdd] = useState("");
  const [newListName, setNewListName] = useState("");
  const [required, setRequired] = useState(false);

  const lists: ReadingListSummary[] = listsResult?.ok ? listsResult.lists : [];
  const isLoading = programmeLoading || listsLoading;

  const handleAddFromLibrary = () => {
    const list = lists.find((l) => l.id === selectedListId);
    const name = list ? list.name : newListName.trim();
    if (!name) return;
    if (!resourceIdToAdd.trim()) return;
    addMutation.mutate(
      {
        readingListName: name,
        resourceId: resourceIdToAdd.trim(),
        moduleId: list?.moduleId ?? null,
        required,
      },
      {
        onSuccess: () => {
          setAddModalOpen(false);
          setResourceIdToAdd("");
          setNewListName("");
          setSelectedListId(null);
        },
      }
    );
  };

  if (isLoading && !programme) {
    return (
      <div className="text-slate-400">Loading programme…</div>
    );
  }

  if (!programme) {
    return (
      <div className="space-y-4">
        <Link href="/programmes" className="text-neon-cyan hover:underline text-sm">
          ← Back to programmes
        </Link>
        <p className="text-amber-400">Programme not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/programmes"
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to programmes
        </Link>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <BookMarked className="w-7 h-7 text-neon-cyan" />
          Reading lists — {programme.name}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {programme.code} · Add resources from the library to programme or module lists.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          <BookOpen className="w-4 h-4" />
          Browse Library
        </Link>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 border border-white/10 hover:bg-white/15"
        >
          <Plus className="w-4 h-4" />
          Add from Library
        </button>
      </div>

      <div className="space-y-6">
        {lists.length === 0 ? (
          <div className="glass rounded-xl border border-white/5 p-8 text-center text-slate-400">
            No reading lists yet. Use &quot;Add from Library&quot; to add a resource to a new or existing list.
          </div>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className="glass rounded-xl border border-white/5 p-4"
            >
              <h2 className="font-display text-lg font-semibold text-white mb-1">
                {list.name}
                {list.moduleTitle && (
                  <span className="text-slate-400 font-normal text-sm ml-2">
                    — {list.moduleTitle}
                  </span>
                )}
              </h2>
              {list.items.length === 0 ? (
                <p className="text-slate-500 text-sm mt-2">No items.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {list.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
                    >
                      <span className="text-slate-200 flex-1">{item.resourceTitle}</span>
                      {item.required && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          Required
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setAddModalOpen(false)}
        >
          <div
            className="glass rounded-xl border border-white/10 p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-white mb-4">
              Add from Library
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              Enter a library resource ID (from Library search). Choose an existing list or type a new list name.
            </p>
            <input
              type="text"
              placeholder="Resource ID"
              value={resourceIdToAdd}
              onChange={(e) => setResourceIdToAdd(e.target.value)}
              className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm mb-3"
            />
            <select
              value={selectedListId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedListId(v || null);
                if (!v) setNewListName("");
              }}
              className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm mb-2"
            >
              <option value="">New list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.moduleTitle ? ` (${l.moduleTitle})` : ""}
                </option>
              ))}
            </select>
            {(selectedListId === "" || !selectedListId) && (
              <input
                type="text"
                placeholder="New list name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm mb-3"
              />
            )}
            <label className="flex items-center gap-2 text-slate-300 text-sm mb-4">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded border-white/20"
              />
              Required reading
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFromLibrary}
                disabled={
                  !resourceIdToAdd.trim() ||
                  (!selectedListId && !newListName.trim()) ||
                  addMutation.isPending
                }
                className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
              >
                {addMutation.isPending ? "Adding…" : "Add"}
              </button>
            </div>
            {addMutation.isError && (
              <p className="text-amber-400 text-sm mt-2">{addMutation.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
