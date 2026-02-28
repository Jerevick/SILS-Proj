"use client";

/**
 * Assignments list for a course — link to submissions (SpeedGrader) per assignment.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type AssignmentsResponse = {
  courseId: string;
  courseTitle: string;
  assignments: {
    id: string;
    title: string;
    type: string;
    dueDate: string | null;
    moduleId: string;
    moduleTitle: string;
  }[];
};

const ASSIGNMENTS_QUERY_KEY = ["course-assignments"] as const;

async function fetchAssignments(courseId: string): Promise<AssignmentsResponse> {
  const res = await fetch(`/api/courses/${courseId}/assignments`);
  if (!res.ok) throw new Error("Failed to fetch assignments");
  return res.json();
}

export default function CourseAssignmentsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, courseId],
    queryFn: () => fetchAssignments(courseId),
    enabled: !!courseId,
  });

  if (isLoading) {
    return (
      <div className="p-6 text-slate-400">
        Loading assignments…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Link href={`/courses/${courseId}`} className="text-neon-cyan hover:underline text-sm">
          ← Back to course
        </Link>
        <p className="text-amber-400">
          {error ? (error as Error).message : "Failed to load assignments."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <Link
          href={`/courses/${courseId}`}
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to {data.courseTitle}
        </Link>
        <h1 className="font-display text-2xl font-bold text-white">
          Assignments & grading
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {data.assignments.length} assignment(s)
        </p>
      </div>

      {data.assignments.length === 0 ? (
        <p className="text-slate-500 text-sm">No assignments yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-lg glass border border-white/5 p-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{a.title}</p>
                <p className="text-slate-500 text-sm">
                  {a.moduleTitle} · {a.type}
                  {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <Link
                href={`/courses/${courseId}/assignments/${a.id}/submissions`}
                className="rounded-lg bg-neon-cyan/20 px-3 py-1.5 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 shrink-0"
              >
                Submissions
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
