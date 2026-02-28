"use client";

/**
 * Collaborative whiteboard with AI suggestions ("clean this diagram", "add explanation").
 * Document snapshot persisted via API; optional link to live session.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";

const BOARD_QUERY_KEY = ["whiteboard"] as const;

type Whiteboard = {
  id: string;
  title: string;
  liveSessionId: string | null;
  documentSnapshot: unknown;
  createdBy: string;
  updatedAt: string;
};

async function fetchBoard(id: string): Promise<Whiteboard> {
  const res = await fetch(`/api/whiteboard/${id}`);
  if (!res.ok) throw new Error("Failed to fetch whiteboard");
  return res.json();
}

async function updateBoardSnapshot(id: string, documentSnapshot: unknown): Promise<Whiteboard> {
  const res = await fetch(`/api/whiteboard/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentSnapshot }),
  });
  if (!res.ok) throw new Error("Failed to save");
  return res.json();
}

async function fetchSuggestion(id: string, request: string, context?: string): Promise<{ suggestion: string; type: string }> {
  const res = await fetch(`/api/whiteboard/${id}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, context }),
  });
  if (!res.ok) throw new Error("Suggestion failed");
  return res.json();
}

export default function WhiteboardPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [suggestInput, setSuggestInput] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [TldrawComponent, setTldrawComponent] = useState<React.ComponentType<{ snapshot?: string; onSave?: (snapshot: string) => void }> | null>(null);

  const { data: board, isLoading: boardLoading, error: boardError } = useQuery({
    queryKey: [...BOARD_QUERY_KEY, id],
    queryFn: () => fetchBoard(id),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: (documentSnapshot: unknown) => updateBoardSnapshot(id, documentSnapshot),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...BOARD_QUERY_KEY, id] });
    },
  });

  useEffect(() => {
    import("@/components/whiteboard/tldraw-embed")
      .then((mod) => setTldrawComponent(() => mod.TldrawEmbed))
      .catch(() => setTldrawComponent(null));
  }, []);

  const handleAskSuggest = useCallback(() => {
    if (!suggestInput.trim()) return;
    setSuggestLoading(true);
    setSuggestion(null);
    fetchSuggestion(id, suggestInput.trim())
      .then((data) => setSuggestion(data.suggestion))
      .catch(() => setSuggestion("Could not get suggestion."))
      .finally(() => setSuggestLoading(false));
  }, [id, suggestInput]);

  if (boardLoading || !id) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading whiteboard…</p>
      </div>
    );
  }

  if (boardError || !board) {
    return (
      <div className="min-h-screen bg-space-950 p-6">
        <Link href="/dashboard" className="text-neon-cyan hover:underline text-sm">
          ← Dashboard
        </Link>
        <p className="text-amber-400 mt-4">Whiteboard not found or failed to load.</p>
      </div>
    );
  }

  const initialSnapshot =
    board.documentSnapshot && typeof board.documentSnapshot === "object" && "document" in (board.documentSnapshot as object)
      ? JSON.stringify(board.documentSnapshot)
      : undefined;

  return (
    <div className="min-h-screen bg-space-950 flex flex-col">
      <header className="glass border-b border-white/5 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
              ← Back
            </Link>
            <h1 className="font-display text-xl font-bold text-white truncate">
              {board.title}
            </h1>
            {board.liveSessionId && (
              <Link
                href={`/live/${board.liveSessionId}`}
                className="text-xs text-neon-cyan hover:underline"
              >
                Live session
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/30">
          {TldrawComponent ? (
            <TldrawComponent
              snapshot={initialSnapshot}
              onSave={(snapshot) => {
                try {
                  const doc = JSON.parse(snapshot) as unknown;
                  saveMutation.mutate(doc);
                } catch {
                  saveMutation.mutate({ document: snapshot });
                }
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-white/10 m-4">
              <div className="text-center text-slate-400">
                <p className="mb-2">Install <code className="bg-white/10 px-1 rounded">tldraw</code> for the canvas.</p>
                <p className="text-sm">AI suggestions work without it.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="w-80 shrink-0 flex flex-col bg-slate-900/50 border-l border-white/5 p-3">
          <h2 className="font-display text-sm font-semibold text-slate-200 mb-2">
            AI suggestions
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            e.g. &quot;Clean this diagram&quot;, &quot;Add explanation&quot;
          </p>
          <input
            type="text"
            value={suggestInput}
            onChange={(e) => setSuggestInput(e.target.value)}
            placeholder="Describe what you want…"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 mb-2"
            onKeyDown={(e) => e.key === "Enter" && handleAskSuggest()}
          />
          <button
            type="button"
            onClick={handleAskSuggest}
            disabled={suggestLoading || !suggestInput.trim()}
            className="w-full py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium mb-3"
          >
            {suggestLoading ? "Thinking…" : "Get suggestion"}
          </button>
          {suggestion && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-slate-300 text-sm">
              {suggestion}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
