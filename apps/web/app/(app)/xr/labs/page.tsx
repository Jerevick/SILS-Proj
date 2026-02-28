"use client";

/**
 * Phase 10: XR Labs list — available immersive labs filtered by enrolled programmes/modules.
 * Uses TanStack Query for data. Links to full-screen viewer at /xr/[labId].
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { XR_LABS_QUERY_KEY } from "@/lib/xr-labs-query";
import type { XRLabListItem } from "@/app/api/xr/labs/route";
import { Glasses, Vr, Box, Sparkles } from "lucide-react";

async function fetchXRLabs(): Promise<XRLabListItem[]> {
  const res = await fetch("/api/xr/labs");
  if (!res.ok) throw new Error("Failed to fetch XR labs");
  return res.json();
}

function XrTypeIcon({ xrType }: { xrType: string }) {
  switch (xrType) {
    case "AR":
      return <Box className="w-4 h-4 text-amber-400" />;
    case "VR":
      return <Vr className="w-4 h-4 text-violet-400" />;
    case "THREE_D":
      return <Glasses className="w-4 h-4 text-cyan-400" />;
    default:
      return <Glasses className="w-4 h-4 text-slate-400" />;
  }
}

export default function XRLabsPage() {
  const { data: labs = [], isLoading, error } = useQuery({
    queryKey: XR_LABS_QUERY_KEY,
    queryFn: fetchXRLabs,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-neon-cyan" />
          Immersive Labs
        </h1>
      </div>
      <p className="text-slate-400 text-sm">
        Browser-based XR experiences — no plugins. Progress syncs with your skills and competencies.
      </p>

      {error && (
        <p className="text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load labs"}
        </p>
      )}

      {isLoading ? (
        <p className="text-slate-400">Loading labs…</p>
      ) : labs.length === 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
          <Glasses className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-500">No XR labs available yet.</p>
          <p className="text-slate-600 text-sm mt-1">
            Enroll in a programme that includes immersive labs, or check back later.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {labs.map((lab) => (
            <li key={lab.id}>
              <Link
                href={`/xr/${lab.id}`}
                className="block rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 hover:border-neon-cyan/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/10 p-2 group-hover:bg-neon-cyan/20 transition-colors">
                    <XrTypeIcon xrType={lab.xrType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-200 group-hover:text-white">
                      {lab.title}
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-slate-500">
                      <span>{lab.programmeName}</span>
                      {lab.programmeModuleTitle && (
                        <span>· {lab.programmeModuleTitle}</span>
                      )}
                      <span className="capitalize">{lab.xrType.replace("_", " ")}</span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm group-hover:text-neon-cyan">
                    Enter →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
