"use client";

/**
 * Phase 26: Alumni events and networking calendar.
 * Events: alumni_networking, career_fair, webinar. Filters by type and date range.
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, ArrowLeft, MapPin, Video } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { canAccessAlumni } from "@/lib/alumni-career-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type EventRow = {
  id: string;
  title: string;
  date: string;
  type: string;
  description: string | null;
  location: string | null;
  createdAt: string;
};

async function fetchEvents(params: { type?: string; from?: string; to?: string }): Promise<EventRow[]> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const res = await fetch(`/api/alumni/events?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  const data = await res.json();
  return data.events ?? [];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  alumni_networking: "Alumni networking",
  career_fair: "Career fair",
  webinar: "Webinar",
};

const EVENT_COLORS: Record<string, string> = {
  alumni_networking: "rgba(0, 245, 255, 0.6)",
  career_fair: "rgba(168, 85, 247, 0.6)",
  webinar: "rgba(34, 197, 94, 0.6)",
};

export default function AlumniEventsPage() {
  const [filters, setFilters] = React.useState<{ type: string; from: string; to: string }>({
    type: "",
    from: "",
    to: "",
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["alumni", "events", filters.type, filters.from, filters.to],
    queryFn: () =>
      fetchEvents({
        type: filters.type || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
  });

  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAlumni(me.role);

  const chartData = React.useMemo(() => {
    const byType: Record<string, number> = {};
    events.forEach((e) => {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
    });
    return Object.entries(byType).map(([type, count]) => ({
      type: EVENT_TYPE_LABELS[type] ?? type,
      count,
      fill: EVENT_COLORS[type] ?? "rgba(148, 163, 184, 0.6)",
    }));
  }, [events]);

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view alumni events.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link
        href="/alumni"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-neon-cyan mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to alumni directory
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6 text-cyan-400" />
        <h1 className="font-display text-xl font-semibold text-white">
          Events & networking
        </h1>
      </div>
      <p className="text-slate-400 mb-6">
        Alumni networking events, career fairs, and webinars. Filter by type and date.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white"
        >
          <option value="">All types</option>
          <option value="alumni_networking">Alumni networking</option>
          <option value="career_fair">Career fair</option>
          <option value="webinar">Webinar</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-white"
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Events by type</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <div className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm">
                        <p className="text-white font-medium">{payload[0].payload.type}</p>
                        <p className="text-cyan-400">{payload[0].payload.count} event(s)</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 text-sm">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-slate-500 text-sm">No events match your filters.</p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex flex-wrap items-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">
                  {EVENT_TYPE_LABELS[event.type] ?? event.type}
                </span>
                <span className="text-slate-500 text-sm">{event.date}</span>
              </div>
              <h3 className="font-medium text-white mt-2">{event.title}</h3>
              {event.location && (
                <p className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  {event.location}
                </p>
              )}
              {event.type === "webinar" && (
                <p className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                  <Video className="w-4 h-4" />
                  Online
                </p>
              )}
              {event.description && (
                <p className="text-slate-400 text-sm mt-2">{event.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
