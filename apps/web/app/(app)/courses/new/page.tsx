"use client";

/**
 * New course — manual form (title, description) or AI AutoBuild (syllabus + learning outcomes).
 */

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { autoBuildCourse } from "@/app/actions/courses";
import { COURSES_QUERY_KEY } from "@/lib/courses-query";

type CreateBody = { title: string; description?: string; mode?: "SYNC" | "ASYNC" };

async function createCourse(body: CreateBody): Promise<{ id: string }> {
  const res = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Failed to create course");
  }
  return res.json();
}

export default function NewCoursePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAutobuild = searchParams.get("autobuild") === "1";
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"SYNC" | "ASYNC">("ASYNC");
  const [syllabus, setSyllabus] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState("");

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
      router.push(`/courses/${data.id}`);
    },
  });

  const autobuildMutation = useMutation({
    mutationFn: autoBuildCourse,
    onSuccess: (data) => {
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
        router.push(`/courses/${data.courseId}`);
      }
    },
  });

  const handleSubmitManual = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      createMutation.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        mode,
      });
    },
    [title, description, mode, createMutation]
  );

  const handleSubmitAutobuild = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!syllabus.trim() || !learningOutcomes.trim()) return;
      autobuildMutation.mutate({ syllabus: syllabus.trim(), learningOutcomes: learningOutcomes.trim() });
    },
    [syllabus, learningOutcomes, autobuildMutation]
  );

  const manualError = createMutation.error?.message;
  const autobuildError = !autobuildMutation.data?.ok && autobuildMutation.data && "error" in autobuildMutation.data
    ? (autobuildMutation.data as { error: string }).error
    : autobuildMutation.error?.message;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex gap-2">
        <Link
          href="/courses"
          className="text-slate-400 hover:text-white text-sm"
        >
          ← Back to courses
        </Link>
        {isAutobuild ? (
          <Link
            href="/courses/new"
            className="text-neon-cyan hover:underline text-sm"
          >
            Manual create
          </Link>
        ) : (
          <Link
            href="/courses/new?autobuild=1"
            className="text-neon-purple hover:underline text-sm"
          >
            AI build from syllabus
          </Link>
        )}
      </div>

      <h2 className="font-display text-xl font-bold text-white">
        {isAutobuild ? "AI build course" : "Create course"}
      </h2>

      {isAutobuild ? (
        <form onSubmit={handleSubmitAutobuild} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Syllabus (paste full syllabus text)
            </label>
            <textarea
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              rows={8}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 px-4 py-3 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50"
              placeholder="Course overview, topics, schedule, policies…"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Learning outcomes
            </label>
            <textarea
              value={learningOutcomes}
              onChange={(e) => setLearningOutcomes(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 px-4 py-3 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50"
              placeholder="By the end of this course, students will be able to…"
              required
            />
          </div>
          {autobuildError && (
            <p className="text-amber-400 text-sm">{autobuildError}</p>
          )}
          <button
            type="submit"
            disabled={autobuildMutation.isPending}
            className="rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
          >
            {autobuildMutation.isPending ? "Building…" : "Generate course"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmitManual} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 px-4 py-3 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50"
              placeholder="e.g. Introduction to Algebra"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 px-4 py-3 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50"
              placeholder="Brief course description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "SYNC" | "ASYNC")}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-4 py-3 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/50"
            >
              <option value="ASYNC">Async (self-paced)</option>
              <option value="SYNC">Sync (live)</option>
            </select>
          </div>
          {manualError && (
            <p className="text-amber-400 text-sm">{manualError}</p>
          )}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create course"}
          </button>
        </form>
      )}
    </div>
  );
}
