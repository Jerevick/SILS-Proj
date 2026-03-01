/**
 * TanStack Query hook for AI Orchestrator API consumption.
 * useOrchestratorMutation: POST /api/ai/orchestrator with action + payload.
 * useOrchestratorChat: global_chat with optional streaming.
 * fetchGlobalChatStream: returns Response for SSE streaming; consume with readStreamToChunks.
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

/** Fetch global chat with streaming (SSE). Returns Response; use readStreamToChunks to consume. */
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

/** Parse SSE stream chunks: yields { text } or { error }. Stops on [DONE] or error. */
export async function* readStreamToChunks(
  response: Response
): AsyncGenerator<{ text?: string; error?: string }> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) yield { error: parsed.error };
            else if (parsed.text) yield { text: parsed.text };
          } catch {
            // skip malformed
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Run global_chat with streaming and call onChunk for each piece, onDone with full text. */
export async function streamGlobalChat(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  callbacks: { onChunk: (chunk: string) => void; onDone: (fullText: string) => void; onError: (error: string) => void }
): Promise<void> {
  const res = await fetchGlobalChatStream(message, history);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    callbacks.onError((data as { error?: string }).error ?? res.statusText);
    return;
  }
  let fullText = "";
  for await (const chunk of readStreamToChunks(res)) {
    if (chunk.error) {
      callbacks.onError(chunk.error);
      return;
    }
    if (chunk.text) {
      fullText += chunk.text;
      callbacks.onChunk(chunk.text);
    }
  }
  callbacks.onDone(fullText);
}

export { ORCHESTRATOR_QUERY_KEY };
