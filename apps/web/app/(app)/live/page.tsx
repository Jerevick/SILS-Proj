"use client";

/**
 * Live sessions list and create. Lecturers can create; everyone in tenant can see and join.
 */

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const SESSIONS_QUERY_KEY = ["live-sessions"] as const;

type Session = {
  id: string;
  title: string;
  status: string;
  roomUrl: string | null;
  createdAt: string;
  attendanceCount: number;
};

async function fetchSessions(): Promise<Session[]> {
  const res = await fetch("/api/live");
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

async function createSession(title: string): Promise<Session> {
  const res = await fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, provider: "daily" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create session");
  }
  return res.json();
}

export default function LiveListPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: fetchSessions,
  });

  const create = useMutation({
    mutationFn: () => createSession(title || "Live class"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      window.location.href = `/live/${data.id}`;
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
            Live classes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Start a class or join an existing session. Video via Daily.co.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
          />
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium"
          >
            Create session
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500">No live sessions yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/live/${s.id}`}
                  className="block rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 text-slate-200 flex items-center justify-between"
                >
                  <span className="font-medium">{s.title}</span>
                  <span className="text-slate-500 text-sm">
                    {s.status} · {s.attendanceCount} attended
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
