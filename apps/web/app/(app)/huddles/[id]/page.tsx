"use client";

/**
 * Real-time collaborative huddle with AI moderator panel.
 * Uses TanStack Query for polling/refetch; moderator can trigger AI summary and see points of confusion.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const HUDDLE_QUERY_KEY = ["huddle"] as const;
const MESSAGES_QUERY_KEY = ["huddle-messages"] as const;

type Huddle = {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
};

type Message = {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
};

async function fetchHuddle(id: string): Promise<Huddle> {
  const res = await fetch(`/api/huddles/${id}`);
  if (!res.ok) throw new Error("Failed to fetch huddle");
  return res.json();
}

async function fetchMessages(id: string, cursor?: string): Promise<{
  messages: Message[];
  nextCursor: string | null;
}> {
  const url = cursor
    ? `/api/huddles/${id}/messages?cursor=${cursor}&limit=50`
    : `/api/huddles/${id}/messages?limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

async function postMessage(id: string, content: string): Promise<Message> {
  const res = await fetch(`/api/huddles/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to send message");
  }
  return res.json();
}

async function runModerate(id: string, previous?: {
  summary: string;
  pointsOfConfusion: string[];
}): Promise<{
  summary: string;
  pointsOfConfusion: string[];
  suggestedPrompt: string | null;
}> {
  const res = await fetch(`/api/huddles/${id}/moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      previousSummary: previous?.summary,
      previousConfusionPoints: previous?.pointsOfConfusion,
    }),
  });
  if (!res.ok) throw new Error("Moderation failed");
  return res.json();
}

export default function HuddlePage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [moderatorSummary, setModeratorSummary] = useState<string>("");
  const [confusionPoints, setConfusionPoints] = useState<string[]>([]);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);

  const { data: huddle, isLoading: huddleLoading, error: huddleError } = useQuery({
    queryKey: [...HUDDLE_QUERY_KEY, id],
    queryFn: () => fetchHuddle(id),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "ACTIVE" ? 5000 : false),
  });

  const {
    data: messagesData,
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: [...MESSAGES_QUERY_KEY, id],
    queryFn: () => fetchMessages(id),
    enabled: !!id && !!huddle,
    refetchInterval: huddle?.status === "ACTIVE" ? 3000 : false,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => postMessage(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...MESSAGES_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [...HUDDLE_QUERY_KEY, id] });
      setInput("");
    },
  });

  const moderate = useMutation({
    mutationFn: () =>
      runModerate(id, moderatorSummary ? { summary: moderatorSummary, pointsOfConfusion: confusionPoints } : undefined),
    onSuccess: (data) => {
      setModeratorSummary(data.summary);
      setConfusionPoints(data.pointsOfConfusion);
      setSuggestedPrompt(data.suggestedPrompt);
    },
  });

  const endHuddle = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/huddles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end: true }),
      });
      if (!res.ok) throw new Error("Failed to end huddle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...HUDDLE_QUERY_KEY, id] });
    },
  });

  const messages = messagesData?.messages ?? [];

  if (huddleLoading || !id) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading huddle…</p>
      </div>
    );
  }

  if (huddleError || !huddle) {
    return (
      <div className="min-h-screen bg-space-950 p-6">
        <Link href="/dashboard" className="text-neon-cyan hover:underline text-sm">
          ← Dashboard
        </Link>
        <p className="text-amber-400 mt-4">Huddle not found or failed to load.</p>
      </div>
    );
  }

  const isActive = huddle.status === "ACTIVE";

  return (
    <div className="min-h-screen bg-space-950 flex flex-col">
      <header className="glass border-b border-white/5 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
              ← Back
            </Link>
            <h1 className="font-display text-xl font-bold text-white truncate">
              {huddle.title}
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
              }`}
            >
              {huddle.status}
            </span>
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => endHuddle.mutate()}
              disabled={endHuddle.isPending}
              className="text-sm px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
            >
              End huddle
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 max-w-7xl w-full mx-auto">
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesLoading && messages.length === 0 ? (
              <p className="text-slate-500 text-sm">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-slate-500 text-sm">No messages yet. Start the conversation.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-white/5 border border-white/10 p-3 max-w-[85%]"
                >
                  <p className="text-xs text-slate-400 mb-1">
                    {m.authorId.slice(0, 8)}… · {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">
                    {m.content}
                  </p>
                </div>
              ))
            )}
          </div>

          {isActive && (
            <form
              className="p-4 border-t border-white/5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = input.trim();
                if (t && !sendMessage.isPending) sendMessage.mutate(t);
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                maxLength={4000}
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMessage.isPending}
                className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium"
              >
                Send
              </button>
            </form>
          )}
        </div>

        <aside className="w-80 shrink-0 flex flex-col bg-slate-900/50 border-l border-white/5">
          <div className="p-3 border-b border-white/5">
            <h2 className="font-display text-sm font-semibold text-slate-200">
              AI Moderator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Summary and points of confusion
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {moderatorSummary && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Summary
                </h3>
                <p className="text-slate-300 text-sm">{moderatorSummary}</p>
              </div>
            )}
            {confusionPoints.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Points of confusion
                </h3>
                <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                  {confusionPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestedPrompt && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
                <p className="text-xs text-amber-300 font-medium mb-1">Suggested prompt</p>
                <p className="text-slate-300 text-sm">{suggestedPrompt}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => moderate.mutate()}
              disabled={moderate.isPending || messages.length === 0}
              className="w-full mt-2 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium"
            >
              {moderate.isPending ? "Running…" : "Run AI summary"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
