/**
 * TanStack Query hook for AI Orchestrator API consumption.
 * useOrchestratorMutation: POST /api/ai/orchestrator with action + payload.
 * useOrchestratorChat: global_chat with optional streaming.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

export type OrchestratorAction =
  | "generate_course"
  | "generate_module"
  | "adaptive_pathway"
  | "grade_submission"
  | "detect_friction_and_intervene"
  | "proactive_insights"
  | "global_chat"
  | "health_check"
  | "semantic_search";

export type OrchestratorPayload = Record<string, unknown>;

export type OrchestratorSuccessResponse = {
  ok: true;
  result: unknown;
  summary?: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };
  latencyMs: number;
};

export type OrchestratorErrorResponse = {
  ok?: false;
  error: string;
  code?: string;
};

export type OrchestratorApiResponse = OrchestratorSuccessResponse | OrchestratorErrorResponse;

const ORCHESTRATOR_QUERY_KEY = ["ai", "orchestrator"] as const;

async function postOrchestrator(
  action: OrchestratorAction,
  payload: OrchestratorPayload,
  options?: { stream?: boolean }
): Promise<OrchestratorApiResponse> {
  const res = await fetch("/api/ai/orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload, stream: options?.stream ?? false }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? res.statusText, code: data.code };
  }
  return res.json();
}

export type UseOrchestratorMutationParams = {
  onSuccess?: (data: OrchestratorApiResponse) => void;
  onError?: (error: Error) => void;
};

export function useOrchestratorMutation(params?: UseOrchestratorMutationParams) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      payload,
      stream,
    }: {
      action: OrchestratorAction;
      payload: OrchestratorPayload;
      stream?: boolean;
    }) => postOrchestrator(action, payload, { stream }),
    onSuccess: (data, variables) => {
      if (params?.onSuccess) params.onSuccess(data);
      queryClient.invalidateQueries({ queryKey: ORCHESTRATOR_QUERY_KEY });
      if (variables.action === "proactive_insights") {
        queryClient.invalidateQueries({ queryKey: ["system-insights"] });
      }
    },
    onError: params?.onError,
  });
}

/** Call global_chat and return assistant text (non-streaming). */
export async function fetchGlobalChat(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const res = await postOrchestrator("global_chat", {
    message,
    history: history ?? [],
  });
  if (!res.ok || !("result" in res)) {
    return { ok: false, error: (res as OrchestratorErrorResponse).error };
  }
  const result = (res as OrchestratorSuccessResponse).result as { text?: string };
  return { ok: true, text: result?.text ?? (res as OrchestratorSuccessResponse).summary ?? "" };
}

/** Fetch global chat with streaming (returns async iterable of chunks). */
export async function fetchGlobalChatStream(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<Response> {
  return fetch("/api/ai/orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "global_chat",
      payload: { message, history: history ?? [] },
      stream: true,
    }),
  });
}

export { ORCHESTRATOR_QUERY_KEY };
