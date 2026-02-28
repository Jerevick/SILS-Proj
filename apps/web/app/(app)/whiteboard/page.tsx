"use client";

/**
 * Whiteboard list and create. Optional ?liveSessionId= to create/link a board to a live session.
 */

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const BOARDS_QUERY_KEY = ["whiteboards"] as const;

type Board = {
  id: string;
  title: string;
  liveSessionId: string | null;
  updatedAt: string;
};

async function fetchBoards(liveSessionId?: string): Promise<Board[]> {
  const url = liveSessionId
    ? `/api/whiteboard?liveSessionId=${liveSessionId}`
    : "/api/whiteboard";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch whiteboards");
  return res.json();
}

async function createBoard(title: string, liveSessionId?: string): Promise<Board> {
  const res = await fetch("/api/whiteboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, liveSessionId: liveSessionId || undefined }),
  });
  if (!res.ok) throw new Error("Failed to create whiteboard");
  return res.json();
}

export default function WhiteboardListPage() {
  const searchParams = useSearchParams();
  const liveSessionId = searchParams.get("liveSessionId") ?? undefined;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: boards = [], isLoading } = useQuery({
    queryKey: [...BOARDS_QUERY_KEY, liveSessionId],
    queryFn: () => fetchBoards(liveSessionId),
  });

  const create = useMutation({
    mutationFn: () => createBoard(title || "New whiteboard", liveSessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: BOARDS_QUERY_KEY });
      window.location.href = `/whiteboard/${data.id}`;
    },
  });

  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="font-display text-xl font-bold text-white">
            Whiteboards
          </h1>
          {liveSessionId && (
            <Link href={`/live/${liveSessionId}`} className="text-sm text-neon-cyan hover:underline mt-1 inline-block">
              Back to live session
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New whiteboard title"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
          />
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium"
          >
            Create
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : boards.length === 0 ? (
          <p className="text-slate-500">No whiteboards yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {boards.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/whiteboard/${b.id}`}
                  className="block rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 text-slate-200"
                >
                  <span className="font-medium">{b.title}</span>
                  <span className="text-slate-500 text-sm ml-2">
                    {new Date(b.updatedAt).toLocaleDateString()}
                    {b.liveSessionId && " · Linked to live session"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
