"use client";

/**
 * Live Classroom: video (Daily.co or LiveKit), screen share, embedded whiteboard link.
 * Fetches join token/room URL and renders iframe; sidebar for AI Co-Host.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const SESSION_QUERY_KEY = ["live-session"] as const;
const TOKEN_QUERY_KEY = ["live-token"] as const;

type Session = {
  id: string;
  title: string;
  status: string;
  roomUrl: string | null;
  provider: string;
  createdBy: string;
};

type TokenResponse = {
  roomUrl: string;
  token: string | null;
  provider: string;
  isLecturer: boolean;
  error?: string;
};

async function fetchSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/live/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

async function fetchToken(sessionId: string): Promise<TokenResponse> {
  const res = await fetch(`/api/live/${sessionId}/token`);
  if (!res.ok) throw new Error("Failed to get join token");
  return res.json();
}

export default function LiveSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const queryClient = useQueryClient();
  const [cohostRequest, setCohostRequest] = useState("");
  const [cohostResponse, setCohostResponse] = useState<string | null>(null);
  const [cohostLoading, setCohostLoading] = useState(false);

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: [...SESSION_QUERY_KEY, sessionId],
    queryFn: () => fetchSession(sessionId),
    enabled: !!sessionId,
    refetchInterval: 10000,
  });

  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: [...TOKEN_QUERY_KEY, sessionId],
    queryFn: () => fetchToken(sessionId),
    enabled: !!sessionId && !!session,
  });

  const startSession = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/live/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "LIVE" }),
      });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SESSION_QUERY_KEY, sessionId] });
      queryClient.invalidateQueries({ queryKey: [...TOKEN_QUERY_KEY, sessionId] });
    },
  });

  const endSession = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/live/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENDED" }),
      });
      if (!res.ok) throw new Error("Failed to end session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SESSION_QUERY_KEY, sessionId] });
    },
  });

  const askCohost = async () => {
    if (!cohostRequest.trim()) return;
    setCohostLoading(true);
    setCohostResponse(null);
    try {
      const res = await fetch(`/api/live/${sessionId}/cohost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRequest: cohostRequest.trim() }),
      });
      const data = await res.json();
      if (data.response) setCohostResponse(data.response);
      else setCohostResponse(data.error ?? "No response.");
    } catch {
      setCohostResponse("Request failed.");
    } finally {
      setCohostLoading(false);
    }
  };

  const roomUrl = tokenData?.roomUrl;
  const isLecturer = tokenData?.isLecturer ?? false;

  if (sessionLoading || !sessionId) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading session…</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-space-950 p-6">
        <Link href="/dashboard" className="text-neon-cyan hover:underline text-sm">
          ← Dashboard
        </Link>
        <p className="text-amber-400 mt-4">Session not found or failed to load.</p>
      </div>
    );
  }

  const canControl = isLecturer;
  const isLive = session.status === "LIVE";
  const isEnded = session.status === "ENDED";

  return (
    <div className="min-h-screen bg-space-950 flex flex-col">
      <header className="glass border-b border-white/5 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
              ← Back
            </Link>
            <h1 className="font-display text-xl font-bold text-white truncate">
              {session.title}
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isLive ? "bg-red-500/20 text-red-400" : isEnded ? "bg-slate-500/20 text-slate-400" : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {session.status}
            </span>
          </div>
          {canControl && !isEnded && (
            <div className="flex gap-2">
              {session.status === "SCHEDULED" && (
                <button
                  type="button"
                  onClick={() => startSession.mutate()}
                  disabled={startSession.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  Start class
                </button>
              )}
              {isLive && (
                <button
                  type="button"
                  onClick={() => endSession.mutate()}
                  disabled={endSession.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  End class
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 p-4">
          {tokenLoading ? (
            <div className="flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <p className="text-slate-400">Loading room…</p>
            </div>
          ) : roomUrl && (isLive || session.status === "SCHEDULED") ? (
            <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-black">
              {tokenData?.provider === "daily" && tokenData.token ? (
                <iframe
                  src={`${roomUrl}#t=${encodeURIComponent(tokenData.token)}`}
                  allow="camera; microphone; fullscreen; display-capture"
                  className="w-full h-full min-h-[400px]"
                  title="Live room"
                />
              ) : (
                <iframe
                  src={roomUrl}
                  allow="camera; microphone; fullscreen; display-capture"
                  className="w-full h-full min-h-[400px]"
                  title="Live room"
                />
              )}
            </div>
          ) : isEnded ? (
            <div className="flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 gap-2">
              <p className="text-slate-400">This session has ended.</p>
              <Link href={`/attendance/${sessionId}`} className="text-neon-cyan hover:underline">
                View attendance
              </Link>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <p className="text-slate-400">
                {tokenData?.error ?? "Waiting for room. Lecturer can start the class."}
              </p>
            </div>
          )}
          <div className="mt-2 flex gap-2 flex-wrap">
            <Link
              href={`/whiteboard?liveSessionId=${sessionId}`}
              className="text-sm text-neon-cyan hover:underline"
            >
              Open whiteboard →
            </Link>
            <Link
              href={`/attendance/${sessionId}`}
              className="text-sm text-slate-400 hover:text-white"
            >
              Attendance
            </Link>
          </div>
        </div>

        <aside className="w-80 shrink-0 flex flex-col bg-slate-900/50 border-l border-white/5 p-3">
          <h2 className="font-display text-sm font-semibold text-slate-200 mb-2">
            AI Co-Host
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Ask questions or get time cues during the class.
          </p>
          <input
            type="text"
            value={cohostRequest}
            onChange={(e) => setCohostRequest(e.target.value)}
            placeholder="Ask the AI…"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 mb-2"
            onKeyDown={(e) => e.key === "Enter" && askCohost()}
          />
          <button
            type="button"
            onClick={askCohost}
            disabled={cohostLoading || !cohostRequest.trim()}
            className="w-full py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 text-sm font-medium mb-3"
          >
            {cohostLoading ? "Thinking…" : "Ask"}
          </button>
          {cohostResponse && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-slate-300 text-sm">
              {cohostResponse}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
