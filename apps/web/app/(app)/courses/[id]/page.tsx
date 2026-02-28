"use client";

/**
 * Course overview — title, description, modules list. Tenant-scoped.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { CourseWithModules } from "@/app/api/courses/[id]/route";

const COURSE_QUERY_KEY = ["course"] as const;

async function fetchCourse(id: string): Promise<CourseWithModules> {
  const res = await fetch(`/api/courses/${id}`);
  if (!res.ok) throw new Error("Failed to fetch course");
  return res.json();
}

export default function CourseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: course, isLoading, error } = useQuery({
    queryKey: [...COURSE_QUERY_KEY, id],
    queryFn: () => fetchCourse(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="text-slate-400">
        Loading course…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-4">
        <Link href="/courses" className="text-neon-cyan hover:underline text-sm">
          ← Back to courses
        </Link>
        <p className="text-amber-400">Course not found or failed to load.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/courses"
            className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
          >
            ← Back to courses
          </Link>
          <h1 className="font-display text-2xl font-bold text-white">
            {course.title}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {course.slug} · {course.mode} · {course.published ? "Published" : "Draft"}
          </p>
        </div>
      </div>

      {course.description && (
        <div className="rounded-xl glass border border-white/5 p-4">
          <h2 className="font-display text-sm font-semibold text-slate-300 mb-2">
            Description
          </h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">
            {course.description}
          </p>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-white mb-4">
          Modules ({course.modules.length})
        </h2>
        <ul className="space-y-2">
          {course.modules.length === 0 ? (
            <li className="text-slate-500 text-sm">No modules yet.</li>
          ) : (
            course.modules.map((m, idx) => (
              <li
                key={m.id}
                className="flex items-center gap-4 rounded-lg glass border border-white/5 p-4"
              >
                <span className="text-slate-500 font-mono text-sm w-8">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{m.title}</p>
                  <p className="text-slate-500 text-sm">
                    {m.contentType ?? "—"} · {m._count.assignments} assignment(s)
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
