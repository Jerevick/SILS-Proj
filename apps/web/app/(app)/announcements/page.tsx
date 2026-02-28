"use client";

/**
 * Phase 17: Centralized announcements feed.
 * Targeted to the user's scope; filters by scope type and date.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Filter, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAnnouncementsForUser } from "@/app/actions/announcement-actions";
import type { AnnouncementScopeType } from "@prisma/client";
import type { AnnouncementFeedItem } from "@/app/actions/announcement-actions";

const SCOPE_LABELS: Record<string, string> = {
  ALL: "All",
  SCHOOL: "School",
  DEPARTMENT: "Department",
  PROGRAMME: "Programme",
  MODULE: "Module",
  ROLE: "Role",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AnnouncementsPage() {
  const [scopeFilter, setScopeFilter] = useState<AnnouncementScopeType | "">("");

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["announcements", scopeFilter],
    queryFn: async (): Promise<AnnouncementFeedItem[]> => {
      const r = await getAnnouncementsForUser({
        scopeFilter: scopeFilter || undefined,
      });
      if (!r.ok) throw new Error(r.error);
      return r.items;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Announcements
        </h1>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select
            value={scopeFilter || "all"}
            onValueChange={(v) => setScopeFilter((v === "all" ? "" : v) as AnnouncementScopeType | "")}
          >
            <SelectTrigger className="w-[180px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <p className="text-slate-400">Loading announcements…</p>
      )}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load announcements."}
        </p>
      )}

      {items && items.length === 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-slate-500 mb-3" />
            <p className="text-slate-400">No announcements yet.</p>
          </CardContent>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((a) => (
            <Card
              key={a.id}
              className="border-white/10 bg-space-800/50 hover:bg-space-800/70 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-semibold text-white">
                    {a.title}
                  </CardTitle>
                  <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(a.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Scope: {SCOPE_LABELS[a.targetScopeType] ?? a.targetScopeType}
                  {a.expiresAt && (
                    <> · Expires {formatDate(a.expiresAt)}</>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
