"use client";

/**
 * Programmes list — Faculty → Department → Programme hierarchy.
 * LMS-Only: shows message that full programme structure is available in Hybrid/SIS; link to Courses (modules).
 * Hybrid/Unified: full hierarchy with curriculum and module links.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMe, isSisAvailable } from "@/hooks/use-me";
import type { ProgrammeHierarchyItem } from "@/app/api/programmes/route";
import { PROGRAMMES_QUERY_KEY } from "@/lib/query-keys";

async function fetchProgrammes(): Promise<ProgrammeHierarchyItem[]> {
  const res = await fetch("/api/programmes");
  if (!res.ok) throw new Error("Failed to fetch programmes");
  return res.json();
}

export default function ProgrammesPage() {
  const { data: me } = useMe();
  const sisAvailable = isSisAvailable(me);

  const { data: hierarchy = [], isLoading, error } = useQuery({
    queryKey: PROGRAMMES_QUERY_KEY,
    queryFn: fetchProgrammes,
    enabled: sisAvailable,
  });

  if (!sisAvailable) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-white">
          Programmes
        </h1>
        <div className="glass rounded-xl border border-white/5 p-6">
          <p className="text-slate-300 mb-2">
            Full programme and curriculum structure (Faculty → Department → Programme → Modules) is available in <strong>Hybrid</strong> or <strong>SIS</strong> deployment.
          </p>
          <p className="text-slate-400 text-sm mb-4">
            In LMS-only mode you manage learning via <strong>Courses</strong> and their modules.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            Go to Courses
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-slate-400">Loading programmes…</div>
    );
  }

  if (error) {
    return (
      <div className="text-amber-400">
        Failed to load programmes. Try again later.
      </div>
    );
  }

  const hasAny = hierarchy.some(
    (f) => f.departments?.some((d) => d.programmes?.length > 0)
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white">
          Programmes
        </h1>
      </div>

      {!hasAny ? (
        <div className="glass rounded-xl border border-white/5 p-6">
          <p className="text-slate-400 mb-4">
            No programmes yet. Create a Faculty, then Department, then Programme to build your curriculum hierarchy.
          </p>
          <p className="text-slate-500 text-sm">
            Use SIS dashboards (Department / School) or API to create faculties and departments, then add programmes from the curriculum page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {hierarchy.map((faculty) => (
            <div
              key={faculty.id}
              className="glass rounded-xl border border-white/5 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                <h2 className="font-display font-semibold text-white">
                  {faculty.name}
                  {faculty.code && (
                    <span className="text-slate-400 font-normal ml-2">
                      {faculty.code}
                    </span>
                  )}
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {faculty.departments.map((dept) => (
                  <div key={dept.id} className="p-4">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">
                      {dept.name}
                      {dept.code && (
                        <span className="text-slate-500 ml-2">{dept.code}</span>
                      )}
                    </h3>
                    <ul className="space-y-2">
                      {dept.programmes.map((prog) => (
                        <li key={prog.id} className="flex items-center gap-4">
                          <Link
                            href={`/programmes/${prog.id}/curriculum`}
                            className="text-neon-cyan hover:underline font-medium"
                          >
                            {prog.name}
                          </Link>
                          <span className="text-slate-500 text-sm">
                            {prog.code} · {prog.credits} credits · {prog._count.modules} module(s)
                          </span>
                          <Link
                            href={`/programmes/${prog.id}/curriculum`}
                            className="text-slate-400 hover:text-white text-sm"
                          >
                            Edit curriculum →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
