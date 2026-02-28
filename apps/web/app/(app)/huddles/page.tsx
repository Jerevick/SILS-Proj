"use client";

/**
 * Huddles list and create. Start a collaborative discussion with AI moderator.
 */

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const HUDDLES_QUERY_KEY = ["huddles"] as const;

type Huddle = {
  id: string;
  title: string;
  status: string;
  startedAt: string;
  messageCount: number;
};

async function fetchHuddles(): Promise<Huddle[]> {
  const res = await fetch("/api/huddles");
  if (!res.ok) throw new Error("Failed to fetch huddles");
  return res.json();
}

async function createHuddle(title: string): Promise<Huddle> {
  const res = await fetch("/api/huddles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create huddle");
  return res.json();
}

export default function HuddlesListPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: huddles = [], isLoading } = useQuery({
    queryKey: HUDDLES_QUERY_KEY,
    queryFn: fetchHuddles,
  });

  const create = useMutation({
    mutationFn: () => createHuddle(title || "New huddle"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HUDDLES_QUERY_KEY });
      window.location.href = `/huddles/${data.id}`;
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
            Huddles
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time collaborative discussions with AI moderator (summary and points of confusion).
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Huddle title"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
          />
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium"
          >
            Start huddle
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : huddles.length === 0 ? (
          <p className="text-slate-500">No huddles yet. Start one above.</p>
        ) : (
          <ul className="space-y-2">
            {huddles.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/huddles/${h.id}`}
                  className="block rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 text-slate-200 flex items-center justify-between"
                >
                  <span className="font-medium">{h.title}</span>
                  <span className="text-slate-500 text-sm">
                    {h.status} · {h.messageCount} messages
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
