"use client";

/**
 * Phase 23: Reserves management dashboard for faculty/librarians.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookMarked, Plus, Trash2 } from "lucide-react";
import {
  getReserves,
  createReserve,
  deleteReserve,
  type ReserveItem,
} from "@/app/actions/library-actions";
import { RESERVES_QUERY_KEY } from "@/lib/query-keys";
import { useQuery as useProgrammesQuery } from "@tanstack/react-query";

async function fetchProgrammes() {
  const res = await fetch("/api/programmes");
  if (!res.ok) throw new Error("Failed to fetch programmes");
  return res.json();
}

export default function LibraryReservesPage() {
  const queryClient = useQueryClient();
  const [programmeFilter, setProgrammeFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [createResourceId, setCreateResourceId] = useState("");
  const [createProgrammeId, setCreateProgrammeId] = useState("");
  const [createFrom, setCreateFrom] = useState("");
  const [createTo, setCreateTo] = useState("");

  const { data: reservesResult, isLoading } = useQuery({
    queryKey: [...RESERVES_QUERY_KEY, programmeFilter || null],
    queryFn: () => getReserves(programmeFilter || null),
  });

  const { data: programmesData } = useProgrammesQuery({
    queryKey: ["programmes"],
    queryFn: fetchProgrammes,
  });

  const programmes = Array.isArray(programmesData)
    ? programmesData.flatMap(
        (f: { departments?: { programmes?: { id: string; name: string; code: string }[] }[] }) =>
          (f.departments ?? []).flatMap(
            (d: { programmes?: { id: string; name: string; code: string }[] }) =>
              d.programmes ?? []
          )
      )
    : [];

  const createMutation = useMutation({
    mutationFn: () =>
      createReserve({
        resourceId: createResourceId.trim(),
        programmeId: createProgrammeId,
        availableFrom: createFrom,
        availableTo: createTo,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESERVES_QUERY_KEY });
      setShowCreate(false);
      setCreateResourceId("");
      setCreateProgrammeId("");
      setCreateFrom("");
      setCreateTo("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReserve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESERVES_QUERY_KEY });
    },
  });

  const reserves: ReserveItem[] = reservesResult?.ok ? reservesResult.reserves : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/library"
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Library
        </Link>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <BookMarked className="w-7 h-7 text-neon-cyan" />
          Reserves
        </h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
        >
          <Plus className="w-4 h-4" />
          New reserve
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-slate-400 text-sm">Programme:</label>
        <select
          value={programmeFilter}
          onChange={(e) => setProgrammeFilter(e.target.value)}
          className="rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">All programmes</option>
          {programmes.map((p: { id: string; name: string; code: string }) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      <div className="glass rounded-xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-slate-400">Loading reserves…</p>
        ) : reserves.length === 0 ? (
          <p className="p-6 text-slate-500">No reserves. Create one to set a resource as reserve for a programme and period.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-3 text-slate-400 font-medium text-sm">Resource</th>
                <th className="p-3 text-slate-400 font-medium text-sm">Programme</th>
                <th className="p-3 text-slate-400 font-medium text-sm">From</th>
                <th className="p-3 text-slate-400 font-medium text-sm">To</th>
                <th className="p-3 text-slate-400 font-medium text-sm w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reserves.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-slate-200">{r.resourceTitle}</td>
                  <td className="p-3 text-slate-300">{r.programmeName}</td>
                  <td className="p-3 text-slate-300">{r.availableFrom}</td>
                  <td className="p-3 text-slate-300">{r.availableTo}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(r.id)}
                      disabled={deleteMutation.isPending}
                      className="text-slate-400 hover:text-red-400 p-1 rounded"
                      title="Remove reserve"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="glass rounded-xl border border-white/10 p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold text-white mb-4">
              New reserve
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              Set a library resource as reserve for a programme and date range.
            </p>
            <input
              type="text"
              placeholder="Library resource ID"
              value={createResourceId}
              onChange={(e) => setCreateResourceId(e.target.value)}
              className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm mb-3"
            />
            <select
              value={createProgrammeId}
              onChange={(e) => setCreateProgrammeId(e.target.value)}
              className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm mb-3"
            >
              <option value="">Select programme</option>
              {programmes.map((p: { id: string; name: string; code: string }) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">From (date)</label>
                <input
                  type="date"
                  value={createFrom}
                  onChange={(e) => setCreateFrom(e.target.value)}
                  className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">To (date)</label>
                <input
                  type="date"
                  value={createTo}
                  onChange={(e) => setCreateTo(e.target.value)}
                  className="w-full rounded-lg bg-space-900 border border-white/10 text-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={
                  !createResourceId.trim() ||
                  !createProgrammeId ||
                  !createFrom ||
                  !createTo ||
                  createMutation.isPending
                }
                className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-amber-400 text-sm mt-2">{createMutation.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
