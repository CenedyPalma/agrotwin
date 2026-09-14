import type { AskResponse } from "@/types";
import { postJson } from "./apiClient";

/**
 * AgroTwin assistant. The backend (backend/app/services/llm_service.py)
 * assembles structured context from the survey's measured analysis and
 * answers with a local Ollama model when one is running, otherwise with a
 * deterministic template responder. `responder` says which — the UI shows it.
 *
 * Voice input/output would plug in around this call (speech-to-text before,
 * text-to-speech after) without changing the service.
 */
export const aiService = {
  ask: (surveyId: string, question: string) =>
    postJson<AskResponse>(`/api/analysis/${encodeURIComponent(surveyId)}/ask`, { question }, { timeoutMs: 90_000 }),
};

/** "ollama:llama3.2:3b" → "Local AI model (llama3.2:3b)"; "template" → "AgroTwin summary (no AI model running)". */
export function responderLabel(responder: string | null | undefined): string {
  if (!responder) return "Unknown responder";
  if (responder.startsWith("ollama:")) return `Local AI model (${responder.slice("ollama:".length)})`;
  if (responder === "template") return "AgroTwin summary (no AI model running)";
  return responder;
}
