"use client";

/**
 * Test page for StudentCoach Agent: send sample friction signals and display AI response.
 * Uses TanStack Query (useMutation) for the coach action and optional router test.
 */

import { useUser } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { runStudentCoach } from "@/app/actions/student-coach";
import { useState } from "react";

const SAMPLE_SIGNALS = [
  { signalType: "DWELL_TIME" as const, payload: { durationSeconds: 420, sectionId: "intro" } },
  { signalType: "QUIZ_ERROR" as const, payload: { attempt: 2, questionId: "q1", errorCount: 2 } },
  { signalType: "HUDDLE_ACTIVITY" as const, payload: { type: "help_request", topic: "algebra" } },
];

export default function TestCoachPage() {
  const { user } = useUser();
  const [routerPrompt, setRouterPrompt] = useState("What is 2 + 2? Reply briefly.");
  const [routerResult, setRouterResult] = useState<Record<string, unknown> | null>(null);
  const [routerLoading, setRouterLoading] = useState(false);

  const coachMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      return runStudentCoach({
        studentId: user.id,
        moduleId: "test-module-1",
        courseId: "test-course-1",
        currentProgress: 35,
        frictionSignals: SAMPLE_SIGNALS,
        moduleTitle: "Introduction to Algebra",
      });
    },
    onSuccess: (data) => {
      if (!data.ok) return;
      // Optionally invalidate any coach-related queries
    },
  });

  async function testRouter() {
    setRouterLoading(true);
    setRouterResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: routerPrompt }),
      });
      const data = await res.json();
      setRouterResult({ status: res.status, ...data });
    } catch (e) {
      setRouterResult({ error: String(e) });
    } finally {
      setRouterLoading(false);
    }
  }

  const coachResult = coachMutation.data;
  const coachOk = coachResult && "ok" in coachResult && coachResult.ok;

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-display font-bold text-slate-100">
        StudentCoach Agent — Test
      </h1>
      <p className="text-slate-400 text-sm">
        Send sample friction signals and see the AI decision (micro-scaffold, alternative
        explanation, or intervention brief). Requires org context and ANTHROPIC_API_KEY.
      </p>

      {/* Coach test */}
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">StudentCoach Agent</h2>
        <p className="text-slate-400 text-sm">
          Sample signals: dwell time 7min, quiz errors (2 attempts), huddle help request.
        </p>
        <button
          type="button"
          onClick={() => coachMutation.mutate()}
          disabled={!user?.id || coachMutation.isPending}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {coachMutation.isPending ? "Running coach…" : "Run Coach"}
        </button>
        {coachMutation.isError && (
          <pre className="text-red-400 text-sm whitespace-pre-wrap">
            {String(coachMutation.error)}
          </pre>
        )}
        {coachResult && !coachOk && "error" in coachResult && (
          <pre className="text-amber-400 text-sm whitespace-pre-wrap">
            {coachResult.error}
          </pre>
        )}
        {coachOk && coachResult && "decision" in coachResult && (
          <div className="mt-3 p-3 rounded bg-slate-800 text-slate-200 text-sm space-y-2">
            <p>
              <strong>Action:</strong>{" "}
              {(coachResult as { decision: { action: string } }).decision.action}
            </p>
            <p>
              <strong>Content:</strong>{" "}
              {(coachResult as { decision: { content: string } }).decision.content || "—"}
            </p>
            <p>
              <strong>Intervention brief created:</strong>{" "}
              {(coachResult as { interventionBriefCreated: boolean }).interventionBriefCreated
                ? "Yes"
                : "No"}
            </p>
            <p>
              <strong>Notification triggered:</strong>{" "}
              {(coachResult as { notificationTriggered: boolean }).notificationTriggered
                ? "Yes"
                : "No"}
            </p>
          </div>
        )}
      </section>

      {/* Router test */}
      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">LLM Router Test</h2>
        <input
          type="text"
          value={routerPrompt}
          onChange={(e) => setRouterPrompt(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500"
          placeholder="Prompt for router"
        />
        <button
          type="button"
          onClick={testRouter}
          disabled={routerLoading}
          className="px-4 py-2 rounded-md bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
        >
          {routerLoading ? "Sending…" : "Test Router"}
        </button>
        {routerResult && (
          <pre className="text-slate-300 text-xs whitespace-pre-wrap bg-slate-800 p-3 rounded">
            {JSON.stringify(routerResult, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
