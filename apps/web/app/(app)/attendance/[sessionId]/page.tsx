"use client";

/**
 * Smart attendance view for a live session: list of participants with engagement scores.
 * Lecturer sees all; students see only themselves. Low engagement triggers StudentCoach (handled in API).
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

const SESSION_QUERY_KEY = ["live-session"] as const;
const ATTENDANCE_QUERY_KEY = ["attendance"] as const;

type Session = {
  id: string;
  title: string;
  status: string;
  createdBy: string;
};

type Record = {
  id: string;
  studentId: string;
  joinedAt: string;
  leftAt: string | null;
  engagementScore: number | null;
  summary: string | null;
};

async function fetchSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/live/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

async function fetchAttendance(sessionId: string): Promise<{ sessionId: string; records: Record[] }> {
  const res = await fetch(`/api/live/${sessionId}/attendance`);
  if (!res.ok) throw new Error("Failed to fetch attendance");
  return res.json();
}

function engagementColor(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

export default function AttendancePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: [...SESSION_QUERY_KEY, sessionId],
    queryFn: () => fetchSession(sessionId),
    enabled: !!sessionId,
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, sessionId],
    queryFn: () => fetchAttendance(sessionId),
    enabled: !!sessionId && !!session,
    refetchInterval: session?.status === "LIVE" ? 10000 : false,
  });

  if (sessionLoading || !sessionId) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="min-h-screen bg-space-950 p-6">
        <Link href="/dashboard" className="text-neon-cyan hover:underline text-sm">
          ← Dashboard
        </Link>
        <p className="text-amber-400 mt-4">Session not found.</p>
      </div>
    );
  }

  const records = attendance?.records ?? [];

  return (
    <div className="min-h-screen bg-space-950">
      <header className="glass border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm mb-2 inline-block">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-white">
              Attendance — {session.title}
            </h1>
            <Link
              href={`/live/${sessionId}`}
              className="text-sm text-neon-cyan hover:underline"
            >
              Live room
            </Link>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Engagement is computed from presence and audio/video activity. Low engagement may trigger follow-up nudges.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {attendanceLoading ? (
          <p className="text-slate-400">Loading attendance…</p>
        ) : records.length === 0 ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
            <p className="text-slate-400">No attendance records yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              When participants join and leave the live session, their engagement is recorded here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Left
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Engagement
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-slate-200 font-mono text-sm">
                      {r.studentId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {new Date(r.joinedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {r.leftAt ? new Date(r.leftAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.engagementScore != null ? (
                        <span className={`font-medium ${engagementColor(r.engagementScore)}`}>
                          {r.engagementScore}% — {r.summary ?? (r.engagementScore >= 80 ? "High" : r.engagementScore >= 50 ? "Moderate" : "Low")}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
