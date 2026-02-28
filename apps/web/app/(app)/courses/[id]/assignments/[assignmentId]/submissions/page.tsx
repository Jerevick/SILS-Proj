"use client";

/**
 * Phase 12: Submissions list for an assignment — AI grading status column, link to SpeedGrader.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

type SubmissionsResponse = {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  submissions: {
    id: string;
    studentId: string;
    grade: string | null;
    feedback: string | null;
    aiGradingStatus: "none" | "ai_suggested" | "finalized";
    confidenceScore: number | null;
    gradeFinalizedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
};

const SUBMISSIONS_QUERY_KEY = ["assignment-submissions"] as const;

async function fetchSubmissions(assignmentId: string): Promise<SubmissionsResponse> {
  const res = await fetch(`/api/assignments/${assignmentId}/submissions`);
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

function aiStatusLabel(status: string): string {
  switch (status) {
    case "finalized":
      return "Finalized";
    case "ai_suggested":
      return "AI suggested";
    default:
      return "Not graded";
  }
}

export default function AssignmentSubmissionsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: [...SUBMISSIONS_QUERY_KEY, assignmentId],
    queryFn: () => fetchSubmissions(assignmentId),
    enabled: !!assignmentId,
  });

  const rows = data?.submissions ?? [];
  const columns: GridColDef<(typeof rows)[number]>[] = [
    {
      field: "studentId",
      headerName: "Student ID",
      width: 180,
      renderCell: (params) => (
        <span className="font-mono text-slate-300">{params.value}</span>
      ),
    },
    {
      field: "grade",
      headerName: "Grade",
      width: 100,
      valueGetter: (_, row) => row.grade ?? "—",
    },
    {
      field: "aiGradingStatus",
      headerName: "AI grading",
      width: 130,
      renderCell: (params) => {
        const status = params.value as string;
        const label = aiStatusLabel(status);
        const color =
          status === "finalized"
            ? "text-emerald-400"
            : status === "ai_suggested"
              ? "text-neon-cyan"
              : "text-slate-500";
        return <span className={color}>{label}</span>;
      },
    },
    {
      field: "confidenceScore",
      headerName: "Confidence",
      width: 100,
      valueFormatter: (value: number | null) =>
        value != null ? `${Math.round(value * 100)}%` : "—",
    },
    {
      field: "gradeFinalizedAt",
      headerName: "Finalized",
      width: 120,
      valueFormatter: (value: string | null) =>
        value ? new Date(value).toLocaleDateString() : "—",
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      width: 120,
      valueFormatter: (value: string) =>
        value ? new Date(value).toLocaleDateString() : "",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Link
          href={`/grading/speedgrader/${params.row.id}`}
          className="text-neon-cyan hover:underline text-sm font-medium"
        >
          Open SpeedGrader
        </Link>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 text-slate-400">
        Loading submissions…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href={`/courses/${courseId}`}
          className="text-neon-cyan hover:underline text-sm"
        >
          ← Back to course
        </Link>
        <p className="text-amber-400">
          {error ? (error as Error).message : "Failed to load submissions."}
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
          Submissions · {data.assignmentTitle}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {data.submissions.length} submission(s)
        </p>
      </div>

      <DashboardDataGrid
        title="Submissions"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        pageSize={10}
      />
    </div>
  );
}
